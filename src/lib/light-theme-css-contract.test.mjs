import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "index.css"), "utf8");
const filterBar = readFileSync(join(root, "components", "FilterBar.tsx"), "utf8");
const smartImg = readFileSync(join(root, "components", "SmartImg.tsx"), "utf8");

function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{(?<body>[^}]+)\\}`).exec(css);
  return match?.groups?.body ?? "";
}

test("light theme hero cards use a light frame instead of the dark shell", () => {
  const body = ruleBody(':root[data-theme="light"] .hero-card');

  assert.match(body, /background:\s*rgb\(var\(--color-ink-900\)\)/);
  assert.doesNotMatch(body, /#1a1715/);
  assert.doesNotMatch(body, /rgba\(0,\s*0,\s*0,\s*0\.7\)/);
  assert.match(smartImg, /var\(--smart-img-skeleton,\s*#1a1715\)/);
});

test("case filters have dedicated light-theme contrast hooks", () => {
  assert.match(filterBar, /case-filter-panel/);
  assert.match(filterBar, /case-filter-control/);
  assert.match(filterBar, /case-filter-meta/);

  assert.notEqual(ruleBody(':root[data-theme="light"] .case-filter-panel'), "");
  assert.notEqual(ruleBody(':root[data-theme="light"] .case-filter-control'), "");
  assert.notEqual(ruleBody(':root[data-theme="light"] .case-filter-meta'), "");
});
