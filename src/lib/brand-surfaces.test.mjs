import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const text = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const brandedSurfaces = [
  "index.html",
  "public/og.svg",
  "src/components/Header.tsx",
  "src/components/Footer.tsx",
  "src/components/SEO.tsx",
  "src/pages/HomePage.tsx",
  "src/pages/AboutPage.tsx",
];
const oldBrandPattern = new RegExp("GPT-Image 2 " + "中文案例库");

test("primary brand surfaces use Tao Studio AI naming", () => {
  for (const path of brandedSurfaces) {
    const source = text(path);
    assert.match(source, /桃子AI视觉实验室|BRAND\.(name|siteTitle|description)/, path);
    assert.doesNotMatch(source, oldBrandPattern, path);
  }
});

test("header and footer render the shared brand logo component", () => {
  assert.match(text("src/components/Header.tsx"), /BrandLogo/, "header should use BrandLogo");
  assert.match(text("src/components/Footer.tsx"), /BrandLogo/, "footer should use BrandLogo");
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
