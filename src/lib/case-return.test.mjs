import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const caseReturnSource = readFileSync(new URL("./caseReturn.ts", import.meta.url), "utf8");
const caseDetailSource = readFileSync(new URL("../pages/CaseDetailPage.tsx", import.meta.url), "utf8");

test("case return storage captures the list scroll position and target viewport offset", () => {
  assert.match(caseReturnSource, /scrollY/);
  assert.match(caseReturnSource, /targetTop/);
  assert.match(caseReturnSource, /getBoundingClientRect/);
});

test("case detail refreshes return metadata without overwriting the stored list viewport", () => {
  assert.match(caseReturnSource, /refreshCaseReturn/);
  assert.match(caseDetailSource, /refreshCaseReturn/);
  assert.doesNotMatch(caseDetailSource, /rememberCaseReturn\(c\.id,\s*targetPath\)/);
  assert.doesNotMatch(caseDetailSource, /rememberCaseReturn\(c\.id,\s*saved\.path\)/);
});
