import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, test } from "node:test";
import { buildSitemap, generateSitemapXml } from "./build-sitemap-core.mjs";

test("buildSitemap writes public/sitemap.xml even when dist is not present", () => {
  const root = mkdtempSync(join(tmpdir(), "taostudio-sitemap-"));
  try {
    mkdirSync(join(root, "public", "data"), { recursive: true });
    writeFileSync(
      join(root, "public", "data", "cases.json"),
      JSON.stringify([
        {
          slug: "demo-case",
          userCategory: "xhs-cover",
          createdAt: "2026-05-21T08:00:00.000Z",
        },
      ]),
      "utf8",
    );

    const result = buildSitemap({
      root,
      today: "2026-05-22",
    });

    const publicXml = readFileSync(join(root, "public", "sitemap.xml"), "utf8");
    assert.equal(result.urls, 7);
    assert.match(publicXml, /<loc>https:\/\/taostudioai\.com\/sitemap<\/loc>/);
    assert.match(publicXml, /<loc>https:\/\/taostudioai\.com\/case\/demo-case<\/loc>/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("generateSitemapXml escapes XML-sensitive URL text", () => {
  const xml = generateSitemapXml({
    today: "2026-05-22",
    cases: [
      {
        slug: "poster-&-kv",
        userCategory: "brand-kv",
        createdAt: "2026-05-20T08:00:00.000Z",
      },
    ],
  });

  assert.match(xml, /poster-&amp;-kv/);
  assert.doesNotMatch(xml, /poster-&-kv/);
});

describe("sitemap derives categories/templates from prerendered dist", () => {
  const gameAssetRegression = { userCategory: "game-asset", slug: "ga-case", createdAt: "2026-08-01" };

  it("lists game-asset and templates when their pages exist in dist", () => {
    const root = mkdtempSync(join(tmpdir(), "sm-"));
    try {
      const cat = join(root, "dist", "category");
      mkdirSync(join(cat, "xhs-cover"), { recursive: true });
      mkdirSync(join(cat, "game-asset"), { recursive: true });
      const tpl = join(root, "dist", "template");
      mkdirSync(join(tpl, "tmpl-9"), { recursive: true });
      const xml = generateSitemapXml({
        cases: [gameAssetRegression],
        today: "2026-08-24",
        distDir: join(root, "dist"),
      });
      assert(xml.includes("/category/game-asset<"), "game-asset must be listed");
      assert(xml.includes("/category/xhs-cover<"), "prerendered category listed");
      assert(xml.includes("/template/tmpl-9<"), "prerendered template listed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("without dist falls back to static list and omits templates", () => {
    const xml = generateSitemapXml({ cases: [gameAssetRegression], today: "2026-08-24" });
    assert(!xml.includes("/category/game-asset<"), "fallback list has no game-asset");
    assert(!xml.includes("/template/"), "no template urls without dist");
    assert(xml.includes("/case/ga-case<"));
  });
});
