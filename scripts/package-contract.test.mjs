import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("prebuild runs the image pipeline in strict mode", () => {
  assert.match(pkg.scripts.prebuild, /node scripts\/build-images\.mjs --strict/);
});

test("check runs the regression test suite", () => {
  assert.match(pkg.scripts.check, /npm run test/);
});
