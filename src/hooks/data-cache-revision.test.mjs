import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const splitData = readFileSync(new URL("../../scripts/split-data.mjs", import.meta.url), "utf8");
const homeDataHook = readFileSync(new URL("./useHomeData.ts", import.meta.url), "utf8");
const searchHook = readFileSync(new URL("./useSearchIndex.ts", import.meta.url), "utf8");
const dataModule = readFileSync(new URL("../lib/data.ts", import.meta.url), "utf8");

test("generated data exposes a content revision to invalidate browser caches", () => {
  assert.match(splitData, /createHash\("sha256"\)/);
  assert.match(splitData, /revision,/);
  assert.match(homeDataHook, /revision:\s*string/);
});

test("search, filters, shards, and the case index use the generated revision", () => {
  assert.match(searchHook, /cases-search\.json\?v=\$\{HOME_DATA\.revision\}/);
  assert.match(searchHook, /filter-options\.json\?v=\$\{HOME_DATA\.revision\}/);
  assert.match(dataModule, /cases-\$\{category\}\.json\?v=\$\{DATA_REVISION\}/);
  assert.match(dataModule, /cases-index\.json\?v=\$\{DATA_REVISION\}/);
});
