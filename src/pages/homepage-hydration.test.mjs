import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homePage = readFileSync(new URL("./HomePage.tsx", import.meta.url), "utf8");

test("homepage defers time-sensitive recent count until after hydration", () => {
  assert.match(homePage, /useState<number \| null>\(null\)/);
  assert.match(homePage, /setRecentCount\(/);
  assert.doesNotMatch(homePage, /const recentCount = useMemo\(/);
});
