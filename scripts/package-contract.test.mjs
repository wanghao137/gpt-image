import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

test("prebuild runs the image pipeline in strict mode", () => {
  assert.match(pkg.scripts.prebuild, /node scripts\/build-images\.mjs --strict/);
});

test("check runs the regression test suite", () => {
  assert.match(pkg.scripts.check, /npm run test/);
});

test("Vercel builds from committed generated data without running external sync", () => {
  assert.match(pkg.scripts["vercel-build"], /^node scripts\/split-data\.mjs && tsc -b/);
  assert.match(pkg.scripts["vercel-build"], /vite-react-ssg build/);
  assert.match(pkg.scripts["vercel-build"], /npm run postbuild/);
  assert.doesNotMatch(pkg.scripts["vercel-build"], /scripts\/sync\.mjs/);
  assert.equal(vercel.buildCommand, "npm run vercel-build");
});
