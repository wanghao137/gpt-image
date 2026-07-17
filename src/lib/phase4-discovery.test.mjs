import assert from "node:assert/strict";
import test from "node:test";
import { AUDIENCE_TASK_ENTRIES } from "./product-navigation.mjs";
import { HOT_CASE_SEARCHES } from "./case-discovery.mjs";
import {
  derivedCaseSearchHref,
  extractTemplateVariables,
  filterAndSortTemplates,
  templateCategories,
} from "./template-discovery.mjs";

test("audience task entries use valid pre-filtered case URLs", () => {
  assert.deepEqual(AUDIENCE_TASK_ENTRIES.map((entry) => entry.id), [
    "creator",
    "merchant",
    "designer",
  ]);
  for (const entry of AUDIENCE_TASK_ENTRIES) {
    const url = new URL(entry.href, "https://taostudioai.com");
    assert.equal(url.pathname, "/cases");
    assert.deepEqual(url.searchParams.get("cat")?.split(","), entry.categories);
  }
});

test("template discovery filters by category and keyword and supports sorting", () => {
  const templates = [
    { id: "b", title: "商品海报", category: "产品", description: "电商主图", useWhen: "上新", tags: ["商业"], createdAt: "2026-01-01" },
    { id: "a", title: "品牌标志", category: "品牌", description: "Logo", useWhen: "提案", tags: ["VI"], createdAt: "2026-02-01" },
  ];
  assert.deepEqual(templateCategories(templates), [
    { label: "产品", count: 1 },
    { label: "品牌", count: 1 },
  ]);
  assert.deepEqual(filterAndSortTemplates(templates, { query: "电商" }).map((item) => item.id), ["b"]);
  assert.deepEqual(filterAndSortTemplates(templates, { category: "品牌" }).map((item) => item.id), ["a"]);
  assert.deepEqual(filterAndSortTemplates(templates, { sort: "newest" }).map((item) => item.id), ["a", "b"]);
  assert.deepEqual(filterAndSortTemplates(templates, { sort: "title" }).map((item) => item.id), ["a", "b"]);
});

test("template variables are deduplicated and keep defaults", () => {
  const variables = extractTemplateVariables(
    '{argument name="品牌名" default="桃子AI"} / {argument name="比例" default="4:5"} / {argument name="品牌名" default="重复"}',
  );
  assert.deepEqual(variables, [
    { name: "品牌名", defaultValue: "桃子AI" },
    { name: "比例", defaultValue: "4:5" },
  ]);
  assert.equal(derivedCaseSearchHref("100021"), "/cases?q=100021");
});

test("hot searches are concise and unique", () => {
  assert.ok(HOT_CASE_SEARCHES.length >= 5);
  assert.equal(new Set(HOT_CASE_SEARCHES).size, HOT_CASE_SEARCHES.length);
  assert.ok(HOT_CASE_SEARCHES.every((item) => item.length <= 12));
});
