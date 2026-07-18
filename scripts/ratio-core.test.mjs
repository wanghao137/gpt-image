import assert from "node:assert/strict";
import test from "node:test";
import { inferCaseRatio, inferExplicitRatio, ratioFromDimensions } from "./ratio-core.mjs";

test("full prompt aspect ratios override category guesses", () => {
  assert.equal(
    inferExplicitRatio("Create a cinematic ultra-wide action keyframe in a 16:9 aspect ratio"),
    "16:9",
  );
  assert.equal(
    inferCaseRatio({ category: "漫画与分镜", prompt: "Use a 3:2 landscape composition" }),
    "3:2",
  );
});

test("real image dimensions normalize to common ratios", () => {
  assert.equal(ratioFromDimensions(280, 158), "16:9");
  assert.equal(ratioFromDimensions(280, 373), "3:4");
  assert.equal(ratioFromDimensions(280, 420), "2:3");
});

test("invalid dimensions do not invent a ratio", () => {
  assert.equal(ratioFromDimensions(0, 100), null);
  assert.equal(ratioFromDimensions(undefined, undefined), null);
});
