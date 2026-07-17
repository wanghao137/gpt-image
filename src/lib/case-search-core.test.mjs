import assert from "node:assert/strict";
import test from "node:test";

import {
  categoriesForSearchEntries,
  createCaseSearchEntry,
  filterCaseSearchEntries,
} from "./case-search-core.mjs";

const entries = [
  createCaseSearchEntry({
    id: "1",
    title: "咖啡店少女插画",
    category: "插画",
    userCategory: "illustration",
    userCategories: ["merchant-poster"],
    promptPreview: "watercolor coffee shop",
    source: "Community",
    tags: ["咖啡"],
    styles: ["watercolor"],
    scenes: ["cafe"],
    platforms: ["xiaohongshu"],
  }),
  createCaseSearchEntry({
    id: "2",
    title: "产品主图",
    category: "电商",
    userCategory: "ecommerce",
    promptPreview: "studio product photo",
    source: "YouMind",
    styles: ["commercial"],
    scenes: ["studio"],
    platforms: ["ecommerce"],
  }),
];

test("search matches the full generated search text", () => {
  assert.deepEqual(
    filterCaseSearchEntries(entries, { query: "watercolor" }).map((entry) => entry.id),
    ["1"],
  );
  assert.deepEqual(
    filterCaseSearchEntries(entries, { query: "咖啡" }).map((entry) => entry.id),
    ["1"],
  );
});

test("search respects secondary categories and metadata filters", () => {
  assert.deepEqual(
    filterCaseSearchEntries(entries, {
      categories: new Set(["merchant-poster"]),
      styles: new Set(["watercolor"]),
      platforms: new Set(["xiaohongshu"]),
    }).map((entry) => entry.id),
    ["1"],
  );
});

test("favorite filtering stays within the full index", () => {
  assert.deepEqual(
    filterCaseSearchEntries(entries, { favoriteIds: new Set(["2"]) }).map((entry) => entry.id),
    ["2"],
  );
});

test("matching entries identify every shard that may contain them", () => {
  assert.deepEqual(
    Array.from(categoriesForSearchEntries([entries[0]])).sort(),
    ["illustration", "merchant-poster"],
  );
});
