import test from "node:test";
import assert from "node:assert/strict";
import { buildFilterOptions } from "./split-data-core.mjs";

const cases = [
  { styles: ["Anime", "Minimal"], scenes: ["Food"], platforms: ["wechat"] },
  { styles: ["Anime"], scenes: ["Food", "Tech"], platforms: [] },
  { styles: ["Realistic"], scenes: [], platforms: ["douyin", "douyin"] },
];

test("counts aggregate per token", () => {
  const opts = buildFilterOptions(cases);
  assert.equal(opts.styleCounts.Anime, 2);
  assert.equal(opts.styleCounts.Minimal, 1);
  assert.equal(opts.sceneCounts.Food, 2);
  assert.equal(opts.sceneCounts.Tech, 1);
  assert.equal(opts.platformCounts.douyin, 1, "duplicate tokens in one row count once");
});

test("arrays sort by count desc, then zh locale", () => {
  const opts = buildFilterOptions(cases);
  assert.deepEqual(opts.styles, ["Anime", "Minimal", "Realistic"]);
  assert.deepEqual(opts.scenes, ["Food", "Tech"]);
});

test("empty input yields empty arrays and counts", () => {
  const opts = buildFilterOptions([]);
  assert.deepEqual(opts.styles, []);
  assert.deepEqual(opts.styleCounts, {});
});
