import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const PLACEHOLDER_PATH = "/images/image-unavailable.svg";
const WEBP_WIDTHS = [320, 480, 640, 960, 1280];
const MANIFEST_PATH = "data/image-store.json";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const manifest = existsSync(MANIFEST_PATH) ? readJson(MANIFEST_PATH) : null;

function assertLocalImageAsset(src, label) {
  assert.notEqual(src, PLACEHOLDER_PATH, `${label} points at the unavailable placeholder`);

  if (src.startsWith("/uploads/")) {
    assert.ok(existsSync(join("public", src)), `${label} is missing ${src}`);
    return;
  }

  if (!src.startsWith("/images/cases/")) {
    if (!src.startsWith("/images/")) return;
    assert.ok(existsSync(join("public", src)), `${label} is missing ${src}`);
    const base = src.replace(/\.(?:jpg|jpeg|png)$/i, "");
    for (const width of WEBP_WIDTHS) {
      const variant = `${base}-${width}.webp`;
      assert.ok(existsSync(join("public", variant)), `${label} is missing ${variant}`);
    }
    return;
  }

  // Store-backed ladder: bytes live in the B2 image store (served same-origin
  // via a Vercel proxy rewrite), so the contract is the committed manifest.
  assert.ok(manifest, `${label} points at ${src} but data/image-store.json is missing`);
  const base = src.replace(/^\/images\/cases\//, "").replace(/\.(?:jpg|jpeg|png)$/i, "");
  const entry = manifest.entries?.[base];
  assert.ok(entry, `${label} (${base}) is missing from the image store manifest`);
  assert.ok(entry.jpgBytes > 0, `${label} (${base}) has an empty canonical JPEG`);
  for (const width of WEBP_WIDTHS) {
    assert.ok(
      (entry.webpBytes?.[width] || 0) > 0,
      `${label} (${base}) is missing store width ${width}`,
    );
  }
}

test("published case and template images never point at missing local assets", () => {
  const cases = readJson("public/data/cases.json");
  const templates = readJson("public/data/templates.json");

  for (const item of cases) {
    assertLocalImageAsset(item.imageUrl, `case#${item.id} ${item.title}`);
  }

  for (const item of templates) {
    assertLocalImageAsset(item.cover, `template#${item.id} ${item.title}`);
  }
});

test("manual template upload covers exist before publishing", () => {
  const templates = readJson("data/manual/templates.json");

  for (const item of templates) {
    assertLocalImageAsset(item.cover, `manual template#${item.id} ${item.title}`);
  }
});

test("the manual hairstyle case is published with its baked local image", () => {
  const cases = readJson("public/data/cases.json");
  const item = cases.find((entry) => entry.id === "100004");

  assert.ok(item, "case#100004 is missing from public/data/cases.json");
  assert.equal(item.title, "人物发型设计");
  assert.equal(item.imageUrl, "/images/case100004.jpg");
  assertLocalImageAsset(item.imageUrl, `case#${item.id} ${item.title}`);
});
