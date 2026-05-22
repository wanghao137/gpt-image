import assert from "node:assert/strict";
import test from "node:test";
import {
  parseThemeMode,
  resolveEffectiveTheme,
  THEME_KEY,
} from "./theme-core.mjs";

test("parseThemeMode accepts only light, dark, and system", () => {
  assert.equal(parseThemeMode("light"), "light");
  assert.equal(parseThemeMode("dark"), "dark");
  assert.equal(parseThemeMode("system"), "system");
  assert.equal(parseThemeMode(""), "system");
  assert.equal(parseThemeMode("sepia"), "system");
  assert.equal(parseThemeMode(null), "system");
});

test("resolveEffectiveTheme follows system only in system mode", () => {
  assert.equal(resolveEffectiveTheme("system", "light"), "light");
  assert.equal(resolveEffectiveTheme("system", "dark"), "dark");
  assert.equal(resolveEffectiveTheme("light", "dark"), "light");
  assert.equal(resolveEffectiveTheme("dark", "light"), "dark");
});

test("THEME_KEY remains compatible with existing localStorage key", () => {
  assert.equal(THEME_KEY, "taostudio.theme");
});
