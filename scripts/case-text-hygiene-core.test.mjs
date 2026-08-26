import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanText,
  isCjkDominant,
  normalizeCaseTitle,
  sanitizeTitleEn,
} from "./case-text-hygiene-core.mjs";

test("normalizeCaseTitle strips known junk prefixes", () => {
  assert.equal(normalizeCaseTitle("提示词："), "");
  assert.equal(normalizeCaseTitle("角色设定提示词："), "");
  assert.equal(normalizeCaseTitle("分辨率："), "");
  assert.equal(normalizeCaseTitle("提示词：赛博朋克城市"), "赛博朋克城市");
  assert.equal(normalizeCaseTitle("薄荷巧克力夏日动漫肖像"), "薄荷巧克力夏日动漫肖像");
});

test("normalizeCaseTitle derives from fallback first sentence when empty", () => {
  const fb = "提示词：\n\n使用上传图片作为人物身份、服装造型参考，生成一组真实自然的成年东亚女性时尚写真。";
  const out = normalizeCaseTitle("提示词：", fb);
  assert.ok(out.startsWith("使用上传图片"), out);
  assert.ok(out.length <= 40, out);
});

test("cleanText kills string null and whitespace", () => {
  assert.equal(cleanText("null"), undefined);
  assert.equal(cleanText("undefined"), undefined);
  assert.equal(cleanText("  "), undefined);
  assert.equal(cleanText(null), undefined);
  assert.equal(cleanText("hello"), "hello");
});

test("isCjkDominant detects Chinese text", () => {
  assert.equal(isCjkDominant("提示词：使用上传图片作为人物身份"), true);
  assert.equal(isCjkDominant("Cyberpunk City Neon"), false);
});

test("sanitizeTitleEn drops CJK-dominant and duplicate titles", () => {
  assert.equal(sanitizeTitleEn("提示词：\n\n使用上传图片作为人物身份、服装造型", "提示词："), undefined);
  assert.equal(sanitizeTitleEn("Cyberpunk City", "赛博朋克城市"), "Cyberpunk City");
  assert.equal(sanitizeTitleEn("Same Title", "Same Title"), undefined);
  assert.equal(sanitizeTitleEn("null", "x"), undefined);
});

test("normalizeCaseTitle treats literal null/undefined strings as empty on both inputs", () => {
  assert.equal(normalizeCaseTitle("null", ""), "");
  assert.equal(normalizeCaseTitle("undefined", ""), "");
  assert.equal(normalizeCaseTitle("提示词：", "null"), "");
  assert.equal(normalizeCaseTitle("提示词：", "undefined"), "");
});

test("normalizeCaseTitle skips a null sentence and uses the next real one", () => {
  const out = normalizeCaseTitle("提示词：", "null\n\n一位年轻女性的真实感写真集。第二句。");
  assert.equal(out, "一位年轻女性的真实感写真集");
});

test("normalizeCaseTitle strips English label prefixes with trailing colon", () => {
  assert.equal(normalizeCaseTitle("Character sheet prompt:"), "");
  assert.equal(normalizeCaseTitle("Resolution:"), "");
  assert.equal(normalizeCaseTitle("Prompt:"), "");
  assert.equal(normalizeCaseTitle("Title:"), "");
  assert.equal(normalizeCaseTitle("Description:"), "");
});

test("normalizeCaseTitle strips the English label and keeps the real title", () => {
  assert.equal(
    normalizeCaseTitle("Character sheet prompt: Cyber Ninja Three-View Turnaround"),
    "Cyber Ninja Three-View Turnaround",
  );
  // Case-insensitive label.
  assert.equal(normalizeCaseTitle("RESOLUTION: 4K product hero shot"), "4K product hero shot");
  // A real title that merely STARTS with these words is kept (no trailing colon).
  assert.equal(normalizeCaseTitle("Title Design Basics"), "Title Design Basics");
});
