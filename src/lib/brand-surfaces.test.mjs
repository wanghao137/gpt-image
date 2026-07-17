import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const text = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const asset = (path) => new URL(`../../${path}`, import.meta.url);
const assetPath = (path) => fileURLToPath(asset(path));

const brandedSurfaces = [
  "index.html",
  "admin.html",
  "public/og.svg",
  "src/components/Header.tsx",
  "src/components/Footer.tsx",
  "src/components/SEO.tsx",
  "src/pages/HomePage.tsx",
  "src/pages/AboutPage.tsx",
  "src/admin/App.tsx",
  "src/admin/README.md",
  "src/admin/ui/Connect.tsx",
  "src/admin/ui/Lock.tsx",
  "src/admin/ui/Shell.tsx",
];
const oldBrandPattern = new RegExp("GPT-Image 2 " + "中文案例库");

test("primary brand surfaces use the unified Chinese brand naming", () => {
  for (const path of brandedSurfaces) {
    const source = text(path);
    assert.match(source, /桃子AI视觉实验室|BRAND\.(name|siteTitle|description|adminTitle)/, path);
    assert.doesNotMatch(source, /Tao Studio AI/, path);
    assert.doesNotMatch(source, oldBrandPattern, path);
  }
});

test("header and footer render the shared brand logo component", () => {
  assert.match(text("src/components/Header.tsx"), /BrandLogo/, "header should use BrandLogo");
  assert.match(text("src/components/Footer.tsx"), /BrandLogo/, "footer should use BrandLogo");
});

test("browser favicon links are cache-busted for the new peach mark assets", () => {
  for (const path of ["index.html", "admin.html"]) {
    const source = text(path);
    assert.match(source, /href="\/favicon-32x32\.png\?v=taostudio-peach-raster-20260522"/, path);
    assert.match(source, /href="\/apple-touch-icon\.png\?v=taostudio-peach-raster-20260522"/, path);
  }
});

test("brand surfaces use the high-fidelity peach raster mark", () => {
  const brandLogo = text("src/components/BrandLogo.tsx");
  const index = text("index.html");
  const admin = text("admin.html");
  const og = text("public/og.svg");

  assert.match(brandLogo, /\/brand\/taostudio-peach-logo-256\.png/);
  assert.match(brandLogo, /\/brand\/taostudio-peach-logo-512\.png/);
  assert.match(index, /<div id="root"><!--app-html--><\/div>/);
  assert.doesNotMatch(index, /boot-overlay/);
  assert.match(admin, /\/brand\/taostudio-peach-logo-128\.png/);
  assert.match(og, /\/brand\/taostudio-peach-logo-512\.png/);
});

test("brand asset generation is reproducible", () => {
  const packageJson = text("package.json");
  const builder = text("scripts/build-brand-assets.mjs");

  assert.match(packageJson, /"brand:assets": "node scripts\/build-brand-assets\.mjs"/);
  assert.match(builder, /DEFAULT_SOURCE/);
  assert.match(builder, /ChatGPT Image 2026\\u5e745\\u670822\\u65e5 17_18_34\.png/);
  assert.match(builder, /BRAND_NAME = "\\u6843\\u5b50AI\\u89c6\\u89c9\\u5b9e\\u9a8c\\u5ba4"/);
});

test("admin surfaces use the shared peach lab brand", () => {
  const adminHtml = text("admin.html");
  const primitives = text("src/admin/ui/Primitives.tsx");
  const lock = text("src/admin/ui/Lock.tsx");
  const connect = text("src/admin/ui/Connect.tsx");
  const shell = text("src/admin/ui/Shell.tsx");

  assert.match(adminHtml, /桃子AI视觉实验室 · 管理后台/);
  assert.doesNotMatch(adminHtml, /Admin · GPT-Image 2 Gallery|<div class="boot">Admin<\/div>/);
  assert.match(primitives, /PeachLogoMark/);
  assert.doesNotMatch(primitives, />A<\/span>/);
  for (const [path, source] of [
    ["src/admin/ui/Lock.tsx", lock],
    ["src/admin/ui/Connect.tsx", connect],
    ["src/admin/ui/Shell.tsx", shell],
  ]) {
    assert.match(source, /BRAND\.(name|latinName|adminTitle)/, path);
    assert.doesNotMatch(source, /Tao Studio AI/, path);
    assert.doesNotMatch(source, /Admin Studio/, path);
  }
});

test("static logo assets expose production brand metadata", () => {
  const favicon = text("public/favicon.svg");
  const og = text("public/og.svg");

  assert.match(favicon, /taostudio-peach-mark/);
  assert.match(favicon, /桃子AI视觉实验室/);
  assert.match(og, /桃子AI视觉实验室/);
  assert.match(og, /GPT-Image 2 Prompt Lab/);
  assert.doesNotMatch(og, /Tao Studio AI/);
});

test("favicon is a peach-only visible mark", () => {
  const favicon = text("public/favicon.svg");

  assert.doesNotMatch(favicon, /<rect\b/i, "favicon should not render a tile behind the peach");
  assert.doesNotMatch(favicon, /<text\b/i, "favicon should not render visible letters or words");
});

test("generated peach raster assets are transparent and tightly cropped", async () => {
  for (const size of [16, 32, 64, 128, 180, 256, 512]) {
    const path = `public/brand/taostudio-peach-logo-${size}.png`;
    assert.equal(existsSync(asset(path)), true, `${path} should exist`);

    const image = sharp(assetPath(path));
    const metadata = await image.metadata();
    assert.equal(metadata.width, size, `${path} width`);
    assert.equal(metadata.height, size, `${path} height`);
    assert.equal(metadata.hasAlpha, true, `${path} should keep transparent background`);

    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3];
    assert.equal(alphaAt(0, 0), 0, `${path} top-left corner should be transparent`);
    assert.equal(alphaAt(info.width - 1, 0), 0, `${path} top-right corner should be transparent`);
    assert.ok(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2)) > 220, `${path} center should be opaque`);

    let minX = info.width;
    let minY = info.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (alphaAt(x, y) > 16) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    const usedWidth = maxX - minX + 1;
    const usedHeight = maxY - minY + 1;
    assert.ok(usedWidth >= size * 0.72, `${path} should not preserve the source image's wide empty margins`);
    assert.ok(usedHeight >= size * 0.72, `${path} should not preserve the source image's tall empty margins`);
  }
});
