import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("case feed keeps loaded pages stable and card identity readable", async () => {
  const [grid, card, casesPage, styles] = await Promise.all([
    readFile(new URL("./CaseGrid.tsx", import.meta.url), "utf8"),
    readFile(new URL("./CaseCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../pages/CasesPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../index.css", import.meta.url), "utf8"),
  ]);

  assert.match(grid, /const appendOnly =/);
  assert.match(grid, /visiblePages\.map/);
  assert.match(grid, /masonry masonry-page/);
  assert.match(grid, /getBoundingClientRect\(\)\.top <= window\.innerHeight \+ 600/);
  assert.doesNotMatch(card, /setNaturalImageRatio/);
  assert.match(card, /sm:flex-col/);
  assert.match(casesPage, /setShardCases\(\(current\) => uniqueCases\(\[\.\.\.current, \.\.\.appendedCases\]\)\)/);
  assert.doesNotMatch(styles, /linear-gradient\(180deg, #fffaf2/);
  assert.doesNotMatch(styles, /\.case-card\s*\{[^}]*content-visibility:\s*auto/s);
});
