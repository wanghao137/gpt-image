import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const caseGrid = readFileSync(new URL("./CaseGrid.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

test("case return restore marks the grid while restoration is active", () => {
  assert.match(caseGrid, /restoreInProgress/);
  assert.match(caseGrid, /case-grid-restoring/);
  assert.match(caseGrid, /onImageLoad=\{isRestoreTarget \? handleRestoreTargetLoad : undefined\}/);
});

test("restoring case grids disable content-visibility height estimation", () => {
  assert.match(css, /\.case-grid-restoring\s+\.case-card/);
  assert.match(css, /content-visibility:\s*visible/);
  assert.match(css, /contain-intrinsic-size:\s*auto/);
});

test("case return restore keeps the grid layout locked after active restoration finishes", () => {
  assert.match(caseGrid, /restoreLayoutLocked/);
  assert.match(caseGrid, /setRestoreLayoutLocked\(true\)/);
  assert.match(caseGrid, /restoreInProgress\s*\|\|\s*restoreLayoutLocked/);
});

test("case return restore does not shrink the rendered page after restore clears", () => {
  assert.doesNotMatch(
    caseGrid,
    /useEffect\(\(\) => \{\s*setVisibleCount\(countForRestore\(cases, paginate, restoreId\)\);\s*\}, \[cases, paginate, restoreId\]\);/,
  );
  assert.match(
    caseGrid,
    /setVisibleCount\(\(current\) => Math\.max\(current, countForRestore\(cases, paginate, restoreId\)\)\)/,
  );
});

test("case return restore uses the captured viewport position before falling back to centering", () => {
  assert.match(caseGrid, /restoreScrollY/);
  assert.match(caseGrid, /restoreTargetTop/);
  assert.match(caseGrid, /window\.scrollTo/);
  assert.match(caseGrid, /Math\.max\(0,\s*Math\.min/);
});
