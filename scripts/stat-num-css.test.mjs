// scripts/stat-num-css.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src", "index.css"), "utf8");

function ruleBody(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `missing rule: ${selector}`);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

test(".stat-num must not use Instrument Serif (its digits are 0.249em wide and collide at stat sizes)", () => {
  const body = ruleBody(".stat-num");
  assert.ok(!body.includes("Instrument Serif"), ".stat-num should inherit the body font");
  assert.ok(body.includes("tabular-nums"), ".stat-num keeps tabular figures");
  assert.ok(!/letter-spacing:\s*-/.test(body), ".stat-num must not tighten tracking");
});

test(".serif-display must not use negative letter-spacing (squeezes narrow digits into neighbors)", () => {
  const body = ruleBody(".serif-display");
  assert.ok(!/letter-spacing:\s*-/.test(body));
});
