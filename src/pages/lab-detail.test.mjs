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

test("detail page uses direct COS imageMogr2 URLs for og:image / main / lightbox", () => {
  const src = readFileSync("src/pages/LabDetailPage.tsx", "utf8");
  assert.match(src, /labImageUrl\(item\.cosKey, 1200\)/);
  assert.match(src, /labImageUrl\(item\.cosKey, 1600, 82\)/);
  assert.match(src, /labImageUrl\(item\.cosKey, 2160, 85\)/);
});

test("detail page offers original download + SPA fallback via prompts shard preload", () => {
  const src = readFileSync("src/pages/LabDetailPage.tsx", "utf8");
  assert.match(src, /labOriginalUrl\(item\.cosKey\)/);
  assert.match(src, /data\/lab\/prompts\/\$\{item\.slug\}\.json/);
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
