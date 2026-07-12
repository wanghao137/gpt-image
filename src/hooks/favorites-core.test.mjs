import test from "node:test";
import assert from "node:assert/strict";
import { parseFavoriteIds, persistFavoriteIds } from "./favorites-core.mjs";

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

test("persistFavoriteIds keeps the existing JSON array format", () => {
  const writes = [];

  const persisted = persistFavoriteIds((value) => writes.push(value), new Set(["1", "2"]));

  assert.equal(persisted, true);
  assert.deepEqual(writes, ['["1","2"]']);
});

test("persistFavoriteIds contains browser storage failures", () => {
  const persisted = persistFavoriteIds(() => {
    throw new DOMException("Storage is disabled", "SecurityError");
  }, new Set(["1"]));

  assert.equal(persisted, false);
});
