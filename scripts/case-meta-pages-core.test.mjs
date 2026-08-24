import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCaseMetaHtml } from "./case-meta-pages-core.mjs";

const SPA = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>占位标题</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

const ROW = {
  id: "100123",
  slug: "test-case-100123",
  title: "赛博朋克城市夜景",
  category: "场景与叙事",
  imageUrl: "/uploads/city.jpg",
  promptPreview: "A neon-lit cyberpunk cityscape at night <script>alert(1)</script>",
  createdAt: "2026-08-20T10:00:00.000Z",
};

describe("buildCaseMetaHtml", () => {
  it("injects title, canonical, og tags and JSON-LD before </head>", () => {
    const html = buildCaseMetaHtml({ spaHtml: SPA, row: ROW });
    assert.match(html, /<title>赛博朋克城市夜景 \| 桃子AI视觉实验室<\/title>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/taostudioai\.com\/case\/test-case-100123" \/>/);
    assert.match(html, /<meta property="og:title"/);
    assert.match(html, /<script type="application\/ld\+json">/);
    assert.ok(html.indexOf("og:title") < html.indexOf("</head>"));
  });

  it("escapes html-sensitive characters in titles and descriptions", () => {
    const html = buildCaseMetaHtml({ spaHtml: SPA, row: ROW });
    assert(!html.includes("<script>alert(1)</script>"), "raw script must not survive");
    assert(html.includes("&lt;script&gt;"), "escaped form present");
  });

  it("promotes a relative imageUrl to an absolute og:image", () => {
    const html = buildCaseMetaHtml({ spaHtml: SPA, row: ROW });
    assert.match(html, /<meta property="og:image" content="https:\/\/taostudioai\.com\/uploads\/city\.jpg" \/>/);
  });

  it("keeps the SPA bootstrap intact and adds exactly one noscript summary", () => {
    const html = buildCaseMetaHtml({ spaHtml: SPA, row: ROW });
    assert.match(html, /<div id="root"><\/div>/);
    assert.equal(html.split("<noscript>").length - 1, 1);
    assert.equal(html.split("</html>").length - 1, 1);
  });

  it("is deterministic (byte-stable across runs)", () => {
    assert.equal(buildCaseMetaHtml({ spaHtml: SPA, row: ROW }), buildCaseMetaHtml({ spaHtml: SPA, row: ROW }));
  });

  it("returns null without slug or title", () => {
    assert.equal(buildCaseMetaHtml({ spaHtml: SPA, row: { ...ROW, slug: "" } }), null);
    assert.equal(buildCaseMetaHtml({ spaHtml: SPA, row: { ...ROW, title: "" } }), null);
  });
});
