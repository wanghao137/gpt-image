import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("/lab/:slug route pre-renders from SSG_LAB_ITEMS", () => {
  const src = readFileSync("src/routes.tsx", "utf8");
  assert.match(src, /path: "lab\/:slug"/);
  assert.match(src, /SSG_LAB_ITEMS\.map\(\(i\) => `\/lab\/\$\{i\.slug\}`\)/);
});

test("detail page renders full prompt in static HTML (SEO) and embeds hydration blob", () => {
  const src = readFileSync("src/pages/LabDetailPage.tsx", "utf8");
  assert.match(src, /item\.prompt\}\s*<\/pre>/);
  assert.match(src, /LAB_HYDRATION_ELEMENT_ID/);
  assert.match(src, /serializeLabHydrationData/);
});

test("detail page never references wsrv for images (R2 fallback stays direct)", () => {
  const src = readFileSync("src/pages/LabDetailPage.tsx", "utf8");
  assert.ok(!src.includes("rawTransformUrl"));
  assert.ok(!src.includes("wsrv"));
});

test("detail page serves browse images same-origin and keeps R2 for original download", () => {
  const src = readFileSync("src/pages/LabDetailPage.tsx", "utf8");
  // og / detail / lightbox all come from the build-time url map
  assert.match(src, /urls\?\.(detail|og|lightbox|orig)/);
  // original download keeps the R2 link
  assert.match(src, /origHref/);
  // NO redundant prompts-shard preload (adversarial review 2026-08-29)
  assert.ok(!src.includes("preloadFetch"));
});

test("shards assemble same-origin baked variants with R2-original fallback", () => {
  const src = readFileSync("scripts/build-lab-data.mjs", "utf8");
  assert.match(src, /\/lab-images\/\$\{item\.id\}-\$\{CARD_W\}\.webp/);
  assert.match(src, /\/lab-images\/\$\{item\.id\}-\$\{DETAIL_W\}\.webp/);
  assert.match(src, /labOriginalUrl\(item\.cosKey/);
  assert.match(src, /lab-urls\.json/);
});

test("stale-window guard present in useLabDetail (lab→lab SPA navigation)", () => {
  const src = readFileSync("src/hooks/useLabDetail.ts", "utf8");
  assert.match(src, /resolvedFor/);
  assert.match(src, /loading \|\| stale/);
});

test("prompt shards bake prev/next neighbours", () => {
  const src = readFileSync("scripts/build-lab-data.mjs", "utf8");
  assert.match(src, /prev: idx > 0 \? \{ slug: visible\[idx - 1\]\.slug/);
});
