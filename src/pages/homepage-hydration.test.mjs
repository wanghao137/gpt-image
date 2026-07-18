import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homePage = readFileSync(new URL("./HomePage.tsx", import.meta.url), "utf8");

test("homepage uses the full-library recent count generated with its static payload", () => {
  assert.match(homePage, /const recentCount = HOME_DATA\.recentCount/);
  assert.doesNotMatch(homePage, /HOME_DATA\.featured\.reduce/);
});

test("cases page hydrates from the same initial batch rendered by SSG", () => {
  const casesPage = readFileSync(new URL("./CasesPage.tsx", import.meta.url), "utf8");
  assert.match(casesPage, /cases: uniqueCases\(\[\.\.\.HOME_DATA\.initial, \.\.\.pages\.flat\(\)\]\)/);
  assert.match(casesPage, /isSSR \? \[\] : initialBrowse\.current!\.cases/);
  assert.match(casesPage, /const candidates = isSSR \? HOME_DATA\.initial : shardCases/);
  assert.match(casesPage, /const totalCount = isSSR \? ALL_CASES\.length : HOME_DATA\.totalCount/);
});

test("cases page loads the full search index only for search-like filters", () => {
  const casesPage = readFileSync(new URL("./CasesPage.tsx", import.meta.url), "utf8");
  assert.match(casesPage, /useSearchIndex\(needsSearchIndex\)/);
  assert.doesNotMatch(casesPage, /Promise\.all\(USER_CATEGORIES/);
  assert.match(casesPage, /loadBrowsePage\(browseLoadedPages\)/);
  assert.doesNotMatch(casesPage, /BROWSE_CATEGORY_ORDER/);
});
