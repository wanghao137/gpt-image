import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detailPage = readFileSync(new URL("./CaseDetailPage.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../index.css", import.meta.url), "utf8");

test("case detail renders a stable branded route loading state instead of an empty page", () => {
  assert.match(detailPage, /function CaseDetailLoading\(\)/);
  assert.match(detailPage, /return <CaseDetailLoading \/>/);
  assert.doesNotMatch(detailPage, /if \(loading && !import\.meta\.env\.SSR\) \{[\s\S]{0,160}return null;/);
  assert.match(detailPage, /min-h-\[calc\(100svh-4rem\)\]/);
  assert.match(detailPage, /aria-busy="true"/);
  assert.match(detailPage, /正在显影案例/);
});

test("case detail loading motion is restrained and respects reduced-motion preferences", () => {
  assert.match(styles, /@keyframes caseDetailDevelop/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.case-detail-loading-frame::after/);
  assert.match(styles, /:root\[data-theme="light"\] \.case-detail-loading-frame/);
});
