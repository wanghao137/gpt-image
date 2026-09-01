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

test("SmartImg serves /lab-images/ direct — never wsrv-wrapped", () => {
  // 2026-08-30 cost-fix regression guard: baked lab variants are same-origin
  // static files; wrapping them in wsrv added NA-proxy RTT AND upscaled
  // 480px thumbs by requesting at the original 2400px width.
  const src = readFileSync("src/components/SmartImg.tsx", "utf8");
  assert.match(src, /startsWith\("\/lab-images\/"\)/);
});

test("lab-cos-core points originals at R2 — COS/imageMogr2 fully retired", () => {
  // 2026-08-30 R2 move EMPTIED the COS bucket, so imageMogr2 URLs 404 and the
  // labImageUrl builder was deleted. Guard against the dead COS base (or a
  // rebuilt imageMogr2 URL template) sneaking back in.
  const src = readFileSync("src/lib/lab-cos-core.mjs", "utf8");
  assert.match(src, /pub-8e95aae17566496ba4c5e5ed16a824cf\.r2\.dev/);
  assert.ok(!src.includes("myqcloud.com"));
  assert.ok(!src.includes("thumbnail/${width}x"));
});
