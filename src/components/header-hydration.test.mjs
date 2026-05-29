import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const header = readFileSync(new URL("./Header.tsx", import.meta.url), "utf8");

test("header theme controls use SSR-stable initial state before client preference sync", () => {
  assert.match(header, /useState<ThemeMode>\("system"\)/);
  assert.match(header, /useState<EffectiveTheme>\("dark"\)/);
  assert.doesNotMatch(header, /useState<ThemeMode>\(initialThemeMode\)/);
  assert.doesNotMatch(header, /useState<EffectiveTheme>\(\(\)\s*=>[\s\S]*getSystemTheme\(\)/);
});
