import assert from "node:assert/strict";
import test from "node:test";

import {
  mergePromptLocales,
  mergePromptLocaleMaps,
  parseGeneratedPromptMarkdown,
  promptLocaleMapFromObject,
  promptLocaleMapToObject,
  stripGeneratedCategoryPrefix,
  summarizePromptLocales,
} from "./upstream-locales.mjs";

const en = `### No. 72: Comic / Storyboard - Underground Parking Chase Storyboard

#### 📖 Description

An English description.

#### 📝 Prompt

\`\`\`
English prompt
\`\`\`

**[Try](https://youmind.com/gpt-image-2-prompts?id=28659)**

---`;

const zh = `### No. 72: 漫画 / 故事板 - 地下停车场追逐分镜脚本

#### 📖 描述

中文描述。

#### 📝 提示词

\`\`\`
中文提示词
\`\`\`

**[试用](https://youmind.com/zh-CN/gpt-image-2-prompts?id=28659)**

---`;

test("generated README parsing extracts official localized content", () => {
  assert.deepEqual(parseGeneratedPromptMarkdown(zh).get("28659"), {
    title: "地下停车场追逐分镜脚本",
    description: "中文描述。",
    prompt: "中文提示词",
  });
});

test("locale cache merging preserves old entries while preferring refreshed fields", () => {
  const merged = mergePromptLocaleMaps(
    new Map([["1", { en: { title: "Old English", prompt: "old" }, zh: { title: "旧标题", prompt: "旧提示" } }]]),
    new Map([["1", { en: { title: "New English", prompt: "new" } }], ["2", { zh: { title: "新增", prompt: "新增提示" } }]]),
  );
  assert.equal(merged.get("1").en.title, "New English");
  assert.equal(merged.get("1").zh.prompt, "旧提示");
  assert.equal(merged.get("2").zh.title, "新增");
  assert.deepEqual(summarizePromptLocales(merged), { total: 2, bilingual: 1, chinese: 2 });
});

test("locale merging keeps matching English and Chinese records", () => {
  const value = mergePromptLocales(en, zh).get("28659");
  assert.equal(value.en.title, "Underground Parking Chase Storyboard");
  assert.equal(value.zh.prompt, "中文提示词");
});

test("only known generated category prefixes are removed", () => {
  assert.equal(stripGeneratedCategoryPrefix("Blue-Haired Portrait"), "Blue-Haired Portrait");
  assert.equal(
    stripGeneratedCategoryPrefix("个人资料 / 头像 - 日系夏日人像"),
    "日系夏日人像",
  );
});

test("official locale cache round-trips through JSON-safe objects", () => {
  const locales = mergePromptLocales(en, zh);
  assert.deepEqual(
    promptLocaleMapFromObject(promptLocaleMapToObject(locales)).get("28659"),
    locales.get("28659"),
  );
});
