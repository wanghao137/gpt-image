import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Source-assertion tests (mirror brand-surfaces.test.mjs): the img pipeline is
// TS/TSX that node --test can't import, so we lock the load-bearing contract
// on the source — COS preset-transform URLs must reach the browser untouched.

test("transformUrl passes imageMogr2 URLs through untouched (no wsrv wrap)", () => {
  const src = readFileSync("src/lib/img.ts", "utf8");
  assert.match(src, /imageMogr2[\s\S]{0,120}return src;/);
});

test("SmartImg renders imageMogr2 URLs direct (same path as /uploads)", () => {
  const src = readFileSync("src/components/SmartImg.tsx", "utf8");
  assert.match(src, /imageMogr2/);
});

test("lab-cos-core derives imageMogr2 URLs against the COS HK public base", () => {
  const src = readFileSync("src/lib/lab-cos-core.mjs", "utf8");
  assert.match(src, /cos\.ap-hongkong\.myqcloud\.com/);
  assert.match(src, /thumbnail\/\$\{width\}x\/format\/webp/);
});
