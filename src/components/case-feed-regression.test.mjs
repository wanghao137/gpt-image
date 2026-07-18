import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("case feed appends ordered browse pages without remounting earlier cards", async () => {
  const [grid, card, casesPage, styles] = await Promise.all([
    readFile(new URL("./CaseGrid.tsx", import.meta.url), "utf8"),
    readFile(new URL("./CaseCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../pages/CasesPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../index.css", import.meta.url), "utf8"),
  ]);

  assert.match(grid, /const appendOnly =/);
  assert.doesNotMatch(grid, /visiblePages\.map/);
  assert.match(grid, /masonry-item/);
  assert.match(grid, /masonry-ready/);
  assert.match(grid, /ResizeObserver/);
  assert.match(grid, /getBoundingClientRect\(\)\.top <= window\.innerHeight \+ 600/);
  assert.match(grid, /aria-live="polite"/);
  assert.match(card, /preserveAspectRatio/);
  assert.match(card, /sm:flex-col/);
  assert.match(casesPage, /setShardCases\(\(current\) => uniqueCases\(\[\.\.\.current, \.\.\.appendedCases\]\)\)/);
  assert.match(casesPage, /loadBrowsePage\(browseLoadedPages\)/);
  assert.doesNotMatch(casesPage, /BROWSE_CATEGORY_ORDER/);
  assert.doesNotMatch(casesPage, /browseLoading\s*\?\s*"正在加载更多案例/);
  assert.doesNotMatch(styles, /linear-gradient\(180deg, #fffaf2/);
  assert.doesNotMatch(styles, /\.case-card\s*\{[^}]*content-visibility:\s*auto/s);
});
