import { test } from "node:test";
import assert from "node:assert/strict";
import {
  absoluteUrl,
  parseRatio,
  imageDimensionsForRatio,
  clipText,
  deriveCaseSeo,
} from "./seo-url.mjs";

test("absoluteUrl keeps absolute http(s) URLs untouched", () => {
  assert.equal(
    absoluteUrl("https://taostudioai.com", "https://cdn.example/y.jpg"),
    "https://cdn.example/y.jpg",
  );
});

test("absoluteUrl promotes a root-relative path", () => {
  assert.equal(
    absoluteUrl("https://taostudioai.com", "/images/a.jpg"),
    "https://taostudioai.com/images/a.jpg",
  );
});

test("absoluteUrl promotes a bare relative path", () => {
  assert.equal(
    absoluteUrl("https://taostudioai.com", "images/a.jpg"),
    "https://taostudioai.com/images/a.jpg",
  );
});

test("absoluteUrl tolerates a trailing slash on the site url", () => {
  assert.equal(
    absoluteUrl("https://taostudioai.com/", "/images/a.jpg"),
    "https://taostudioai.com/images/a.jpg",
  );
});

test("absoluteUrl returns empty string for empty input", () => {
  assert.equal(absoluteUrl("https://taostudioai.com", ""), "");
  assert.equal(absoluteUrl("https://taostudioai.com", null), "");
  assert.equal(absoluteUrl("https://taostudioai.com", undefined), "");
});

test("absoluteUrl leaves data: URLs untouched", () => {
  assert.equal(
    absoluteUrl("https://taostudioai.com", "data:image/svg+xml;utf8,<svg/>"),
    "data:image/svg+xml;utf8,<svg/>",
  );
});

test("parseRatio parses common ratios", () => {
  assert.deepEqual(parseRatio("9:16"), [9, 16]);
  assert.deepEqual(parseRatio("16:9"), [16, 9]);
  assert.deepEqual(parseRatio("4:5"), [4, 5]);
  assert.deepEqual(parseRatio("1:1"), [1, 1]);
});

test("parseRatio tolerates whitespace and alt separators", () => {
  assert.deepEqual(parseRatio("4 : 5"), [4, 5]);
  assert.deepEqual(parseRatio("16x9"), [16, 9]);
  assert.deepEqual(parseRatio("3／4"), [3, 4]);
});

test("parseRatio returns null for garbage", () => {
  assert.equal(parseRatio(""), null);
  assert.equal(parseRatio("portrait"), null);
  assert.equal(parseRatio("0:0"), null);
  assert.equal(parseRatio(null), null);
});

test("imageDimensionsForRatio derives height from ratio at width 1200", () => {
  assert.deepEqual(imageDimensionsForRatio("9:16", 1200), { width: 1200, height: 2133 });
  assert.deepEqual(imageDimensionsForRatio("16:9", 1200), { width: 1200, height: 675 });
  assert.deepEqual(imageDimensionsForRatio("1:1", 1200), { width: 1200, height: 1200 });
  assert.deepEqual(imageDimensionsForRatio("4:5", 1200), { width: 1200, height: 1500 });
});

test("imageDimensionsForRatio falls back to 4:5 for unparseable ratio", () => {
  assert.deepEqual(imageDimensionsForRatio("", 1200), { width: 1200, height: 1500 });
  assert.deepEqual(imageDimensionsForRatio("garbage", 1200), { width: 1200, height: 1500 });
});

test("clipText collapses whitespace and truncates with ellipsis", () => {
  assert.equal(clipText("  a\n b   c ", 100), "a b c");
  assert.equal(clipText("abcdef", 4), "abc…");
  assert.equal(clipText("abc", 3), "abc");
  assert.equal(clipText("", 10), "");
  assert.equal(clipText(null, 10), "");
});

test("deriveCaseSeo builds the same title/description shape migrate-v2 used to bake", () => {
  const { seoTitle, seoDescription } = deriveCaseSeo(
    { title: "人像写真示例", promptPreview: "一张胶片感人像写真，柔和光线。" },
    "人像写真",
  );
  assert.equal(seoTitle, "人像写真示例 · GPT-Image 2 Prompt 案例 | 人像写真");
  assert.ok(seoDescription.startsWith("一张胶片感人像写真，柔和光线。"));
  assert.ok(seoDescription.endsWith("中英双语 Prompt，一键复制，快速复用。"));
});

test("deriveCaseSeo falls back to title when promptPreview is empty", () => {
  const { seoDescription } = deriveCaseSeo({ title: "无预览案例", promptPreview: "" }, "其他用例");
  assert.ok(seoDescription.startsWith("无预览案例"));
});

test("deriveCaseSeo clips a long promptPreview to 110 chars + tail", () => {
  const long = "字".repeat(300);
  const { seoDescription } = deriveCaseSeo({ title: "x", promptPreview: long }, "通用海报");
  // head is clipped to 110 (109 chars + ellipsis), then the tail is appended.
  assert.ok(seoDescription.includes("…——"));
  assert.ok(seoDescription.length < 160);
});
