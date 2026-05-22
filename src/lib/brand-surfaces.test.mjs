import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const text = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

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

test("primary brand surfaces use Tao Studio AI naming", () => {
  for (const path of brandedSurfaces) {
    const source = text(path);
    assert.match(source, /桃子AI视觉实验室|BRAND\.(name|siteTitle|description|adminTitle)/, path);
    assert.doesNotMatch(source, oldBrandPattern, path);
  }
});

test("header and footer render the shared brand logo component", () => {
  assert.match(text("src/components/Header.tsx"), /BrandLogo/, "header should use BrandLogo");
  assert.match(text("src/components/Footer.tsx"), /BrandLogo/, "footer should use BrandLogo");
});

test("browser favicon links are cache-busted for the peach mark", () => {
  for (const path of ["index.html", "admin.html"]) {
    const source = text(path);
    assert.match(source, /href="\/favicon\.svg\?v=taostudio-peach-20260522"/, path);
  }
});

test("admin surfaces use the shared Tao Studio AI brand", () => {
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
    assert.doesNotMatch(source, /Admin Studio/, path);
  }
});

test("static logo assets expose production brand metadata", () => {
  const favicon = text("public/favicon.svg");
  const og = text("public/og.svg");

  assert.match(favicon, /taostudio-peach-mark/);
  assert.match(favicon, /桃子AI视觉实验室/);
  assert.match(og, /桃子AI视觉实验室/);
  assert.match(og, /Tao Studio AI/);
});

test("favicon is a peach-only visible mark", () => {
  const favicon = text("public/favicon.svg");

  assert.doesNotMatch(favicon, /<rect\b/i, "favicon should not render a tile behind the peach");
  assert.doesNotMatch(favicon, /<text\b/i, "favicon should not render visible letters or words");
});
