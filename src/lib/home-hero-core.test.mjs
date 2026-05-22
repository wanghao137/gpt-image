import assert from "node:assert/strict";
import test from "node:test";
import { selectHeroCases } from "./home-hero-core.mjs";

function makeCases(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1),
    title: `Case ${index + 1}`,
    imageUrl: `/images/case${index + 1}.jpg`,
  }));
}

test("selectHeroCases returns five deterministic unique cases for a seed", () => {
  const cases = makeCases(30);

  const first = selectHeroCases(cases, { limit: 5, seed: 137 });
  const second = selectHeroCases(cases, { limit: 5, seed: 137 });

  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
  assert.equal(first.length, 5);
  assert.equal(new Set(first.map((item) => item.id)).size, 5);
});

test("selectHeroCases changes the hero deck when the seed changes", () => {
  const cases = makeCases(30);

  const first = selectHeroCases(cases, { limit: 5, seed: 137 }).map((item) => item.id);
  const second = selectHeroCases(cases, { limit: 5, seed: 271 }).map((item) => item.id);

  assert.notDeepEqual(first, second);
});

test("selectHeroCases keeps SSR-safe fallbacks when the list is short", () => {
  const cases = makeCases(3);

  assert.deepEqual(
    selectHeroCases(cases, { limit: 5, seed: 137 }).map((item) => item.id),
    ["1", "2", "3"],
  );
});
