import test from "node:test";
import assert from "node:assert/strict";
import {
  inferCaseFields,
  inferTemplateFields,
  makePromptPreview,
} from "../src/admin/content-automation-core.mjs";

test("makePromptPreview flattens whitespace and clips long prompts", () => {
  const prompt = `第一行

第二行 ${"细节".repeat(140)}`;
  const preview = makePromptPreview(prompt, 80);

  assert.equal(preview.includes("\n"), false);
  assert.equal(preview.length, 80);
  assert.equal(preview.endsWith("…"), true);
});

test("inferCaseFields fills preview alt styles scenes and tags from prompt signals", () => {
  const result = inferCaseFields({
    id: "100123",
    title: "小红书奶茶新品促销海报",
    category: "海报与排版",
    styles: [],
    scenes: [],
    imageUrl: "/uploads/milk-tea.jpg",
    prompt:
      "为本地奶茶门店生成竖版 poster，突出限时促销、价格标签、手机端可读标题和真实商品摄影。",
  });

  assert.equal(result.promptPreview.startsWith("为本地奶茶门店生成竖版 poster"), true);
  assert.equal(result.imageAlt, "小红书奶茶新品促销海报");
  assert.ok(result.styles.includes("Poster"));
  assert.ok(result.styles.includes("Realistic"));
  assert.ok(result.scenes.includes("Commerce"));
  assert.ok(result.scenes.includes("Social"));
  assert.ok(result.tags.includes("Poster"));
  assert.ok(result.tags.includes("Commerce"));
});

test("inferCaseFields can preserve non-empty manually edited fields", () => {
  const result = inferCaseFields(
    {
      id: "100124",
      title: "品牌 KV 系统",
      category: "品牌与标志",
      styles: ["Editorial"],
      scenes: ["Brand"],
      imageUrl: "/uploads/brand.jpg",
      imageAlt: "保留的替代文本",
      prompt: "为新消费品牌生成 logo、包装、KV 延展和社媒触点展示。",
      promptPreview: "手写预览",
      tags: ["Manual"],
    },
    { overwrite: false },
  );

  assert.equal(result.promptPreview, "手写预览");
  assert.equal(result.imageAlt, "保留的替代文本");
  assert.deepEqual(result.tags, ["Manual"]);
  assert.ok(result.styles.includes("Editorial"));
  assert.ok(result.scenes.includes("Brand"));
});

test("inferTemplateFields fills empty template helper copy without overwriting prompt", () => {
  const result = inferTemplateFields({
    id: "derived-local-promo",
    title: "本地商家促销海报",
    category: "海报与排版",
    tags: [],
    description: "",
    cover: "/images/template.jpg",
    prompt: "模板 Prompt 正文",
    useWhen: "",
  });

  assert.equal(result.prompt, "模板 Prompt 正文");
  assert.equal(result.description, "用于海报与排版的本地商家促销海报模板。");
  assert.equal(result.useWhen, "适合需要快速复用「本地商家促销海报」结构的内容生产场景。");
  assert.ok(result.tags.includes("Poster"));
});
