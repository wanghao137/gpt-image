import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homePage = readFileSync(new URL("./HomePage.tsx", import.meta.url), "utf8");

test("homepage uses the full-library recent count generated with its static payload", () => {
  assert.match(homePage, /const recentCount = HOME_DATA\.recentCount/);
  assert.doesNotMatch(homePage, /HOME_DATA\.featured\.reduce/);
});
