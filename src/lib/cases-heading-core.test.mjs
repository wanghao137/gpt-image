import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCasesDocumentTitle,
  formatCasesHeading,
} from "./cases-heading-core.mjs";

test("unfiltered state keeps the canonical heading", () => {
  const out = formatCasesHeading(16190, 16190, false);
  assert.equal(out.text, "按场景筛选 16190 个 GPT-Image 2 案例");
  assert.equal(out.filtered, false);
});

test("filtered state shows matched count", () => {
  const out = formatCasesHeading(16190, 5448, true);
  assert.equal(out.text, "筛选出 5448 个案例");
  assert.equal(out.filtered, true);
});

test("document title reflects filtered state", () => {
  assert.equal(
    formatCasesDocumentTitle(16190, 16190, false),
    "全部案例 · 16190+ GPT-Image 2 真实案例 | 桃子AI视觉实验室",
  );
  assert.equal(
    formatCasesDocumentTitle(16190, 5448, true),
    "筛选出 5448 个案例 · GPT-Image 2 | 桃子AI视觉实验室",
  );
});
