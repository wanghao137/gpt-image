import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detailPage = readFileSync(new URL("./CaseDetailPage.tsx", import.meta.url), "utf8");

test("case detail image stage corrects inferred metadata with decoded dimensions", () => {
  assert.match(detailPage, /naturalImageRatio\?\.caseId === c\.id/);
  assert.match(detailPage, /aspectRatio: naturalImageRatio\.aspectRatio/);
  assert.match(detailPage, /onNaturalSize=\{\(width, height\) =>/);
  assert.match(detailPage, /objectFit="contain"/);
});
