import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCaseTags, normalizeTagToken } from "./tag-normalize-core.mjs";

test("synonyms collapse before group filtering", () => {
  assert.equal(normalizeTagToken("Brand Identity"), "Brand");
  assert.equal(normalizeTagToken("3D"), "3D Render");
  assert.equal(normalizeTagToken("Anime"), "Anime");
});

test("depiction tokens are removed from styles, kept in scenes", () => {
  const out = normalizeCaseTags({ styles: ["Poster", "Anime"], scenes: ["Poster", "Food"] });
  assert.deepEqual(out.styles, ["Anime"]);
  assert.deepEqual(out.scenes, ["Poster", "Food"]);
});

test("style tokens are removed from scenes, kept in styles", () => {
  const out = normalizeCaseTags({ styles: ["Editorial", "Minimal"], scenes: ["Editorial", "Tech"] });
  assert.deepEqual(out.styles, ["Editorial", "Minimal"]);
  assert.deepEqual(out.scenes, ["Tech"]);
});

test("Artistic is dropped from both groups (too generic)", () => {
  const out = normalizeCaseTags({ styles: ["Artistic", "Realistic"], scenes: ["Artistic", "Travel"] });
  assert.deepEqual(out.styles, ["Realistic"]);
  assert.deepEqual(out.scenes, ["Travel"]);
});

test("mixed tags pool gets synonyms but no group removal, and dedupes", () => {
  const out = normalizeCaseTags({ tags: ["Brand Identity", "Brand", "3D", "Anime"] });
  assert.deepEqual(out.tags, ["Brand", "3D Render", "Anime"]);
});

test("missing/empty fields produce empty arrays, not undefined", () => {
  assert.deepEqual(normalizeCaseTags({}), { styles: [], scenes: [], tags: [] });
});
