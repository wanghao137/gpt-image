import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    assert.equal(result.urls, 8);
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

test("buildSitemap can skip the public copy via alsoWritePublic:false", () => {
  const root = mkdtempSync(join(tmpdir(), "taostudio-sitemap-nopub-"));
  try {
    mkdirSync(join(root, "public", "data"), { recursive: true });
    writeFileSync(join(root, "public", "data", "cases.json"), "[]");
    const result = buildSitemap({ root, today: "2026-08-24", alsoWritePublic: false });
    assert(!existsSync(join(root, "public", "sitemap.xml")), "public copy must be skipped");
    assert.deepEqual(result.written, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("sitemap lists 4K lab pages", () => {
  it("/lab index ships via STATIC_PATHS", () => {
    const xml = generateSitemapXml({ cases: [], today: "2026-08-28" });
    assert(xml.includes("/lab<"), "/lab static path listed");
  });

  it("without dist, lab detail slugs come from labSlugs", () => {
    const xml = generateSitemapXml({
      cases: [],
      labSlugs: ["20260828-abc", "20260801-def"],
      today: "2026-08-28",
    });
    assert(xml.includes("/lab/20260828-abc<"));
    assert(xml.includes("/lab/20260801-def<"));
  });

  it("with dist, lists exactly what pre-rendered (skips index, ignores fallback)", () => {
    const root = mkdtempSync(join(tmpdir(), "sm-lab-"));
    try {
      const lab = join(root, "dist", "lab");
      mkdirSync(join(lab, "index"), { recursive: true });
      mkdirSync(join(lab, "20260828-abc"), { recursive: true });
      const xml = generateSitemapXml({
        cases: [],
        labSlugs: ["20260801-should-not-appear"],
        today: "2026-08-28",
        distDir: join(root, "dist"),
      });
      assert(xml.includes("/lab/20260828-abc<"), "prerendered lab slug listed");
      assert(!xml.includes("should-not-appear"), "dist scan wins over fallback list");
      // /lab index dir must not produce a duplicate /lab/index URL
      assert(!xml.includes("/lab/index<"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("buildSitemap reads lab slugs from public/data/lab-index.json", () => {
    const root = mkdtempSync(join(tmpdir(), "sm-labidx-"));
    try {
      mkdirSync(join(root, "public", "data"), { recursive: true });
      writeFileSync(join(root, "public", "data", "cases.json"), "[]");
      writeFileSync(
        join(root, "public", "data", "lab-index.json"),
        JSON.stringify([{ id: "a", slug: "20260828-a" }]),
        "utf8",
      );
      buildSitemap({ root, today: "2026-08-28" });
      const xml = readFileSync(join(root, "public", "sitemap.xml"), "utf8");
      assert(xml.includes("/lab/20260828-a<"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
