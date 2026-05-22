import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
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
