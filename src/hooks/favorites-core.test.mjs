import test from "node:test";
import assert from "node:assert/strict";
import { parseFavoriteIds } from "./favorites-core.mjs";

test("parseFavoriteIds restores string ids and de-duplicates them", () => {
  assert.deepEqual([...parseFavoriteIds(JSON.stringify(["1", "2", "1"]))], ["1", "2"]);
});

test("parseFavoriteIds tolerates older numeric ids", () => {
  assert.deepEqual([...parseFavoriteIds(JSON.stringify([101, "102"]))], ["101", "102"]);
});

test("parseFavoriteIds rejects malformed or non-array storage payloads", () => {
  assert.deepEqual([...parseFavoriteIds("{nope")], []);
  assert.deepEqual([...parseFavoriteIds(JSON.stringify("abc"))], []);
  assert.deepEqual([...parseFavoriteIds(JSON.stringify({ id: "1" }))], []);
});
