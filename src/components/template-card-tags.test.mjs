import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const component = readFileSync(new URL("./TemplateCard.tsx", import.meta.url), "utf8");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "index.css"), "utf8");

test("template cards render tags as a contained capability strip", () => {
  assert.match(component, /visibleTags\s*=\s*data\.tags\.slice\(0,\s*3\)/);
  assert.match(component, /hiddenTagCount\s*=\s*Math\.max\(0,\s*data\.tags\.length - visibleTags\.length\)/);
  assert.match(component, /template-capability-strip/);
  assert.match(component, /template-capability-tags/);
  assert.match(component, /template-capability-tag/);
  assert.match(component, /template-capability-more/);
  assert.doesNotMatch(component, /className="flex flex-wrap gap-1\.5"/);
});

test("template capability tags have stable card-level styles", () => {
  for (const selector of [
    ".template-capability-strip",
    ".template-capability-label",
    ".template-capability-tags",
    ".template-capability-tag",
    ".template-capability-more",
  ]) {
    assert.match(css, new RegExp(`${selector.replace(".", "\\.")}\\s*\\{`), selector);
  }

  assert.match(css, /min-h-\[/);
  assert.match(css, /:root\[data-theme="light"\] \.template-capability-strip/);
});
