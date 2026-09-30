import assert from "node:assert/strict";
import test from "node:test";

import { localImageBase } from "./img-local-core.mjs";

test("legacy flat /images paths keep extracting a base", () => {
  assert.equal(localImageBase("/images/case100004.jpg"), "/images/case100004");
  assert.equal(localImageBase("/images/template7.png"), "/images/template7");
});

test("store paths /images/cases/<base>.jpg extract a base (2026-09-30 P1 regression)", () => {
  // Before the fix the regex rejected the nested "cases/" segment, so every
  // store-backed case fell back to the raw 1200px JPEG and the whole WebP
  // ladder in the bucket was dead weight — a 3-6x byte regression on CN
  // mobile, the exact audience this pipeline exists for.
  assert.equal(
    localImageBase("/images/cases/case35567.jpg"),
    "/images/cases/case35567",
  );
});

test("variant files, deep paths and foreign roots return null", () => {
  assert.equal(localImageBase("/images/cases/case1-320.webp"), null);
  assert.equal(localImageBase("/images/a/b/case1.jpg"), null);
  assert.equal(localImageBase("/uploads/2026-01-01-x.jpg"), null);
  assert.equal(localImageBase("https://example.com/a.jpg"), null);
  assert.equal(localImageBase("/images/image-unavailable.svg"), null);
});
