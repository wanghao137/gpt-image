import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { sortCasesForDisplay } from "./caseSort.ts";

test("client case sorting keeps newer cases ahead across category shard order", () => {
  const sorted = sortCasesForDisplay([
    { id: "900", createdAt: "2026-07-16T00:00:00.000Z", category: "portrait" },
    { id: "100", createdAt: "2026-07-17T00:00:00.000Z", category: "illustration" },
    { id: "800", createdAt: "2026-07-16T12:00:00.000Z", category: "portrait" },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["100", "800", "900"],
  );
});

test("client case sorting uses descending numeric id for same-sync timestamps", () => {
  const createdAt = "2026-07-17T01:49:30.607Z";
  const sorted = sortCasesForDisplay([
    { id: "28844", createdAt },
    { id: "28852", createdAt },
    { id: "28851", createdAt },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["28852", "28851", "28844"],
  );
});

test("client case sorting leaves invalid dates last and remains stable", () => {
  const sorted = sortCasesForDisplay([
    { id: "3", createdAt: "invalid" },
    { id: "2", createdAt: "invalid" },
    { id: "1", createdAt: "2026-07-17T00:00:00.000Z" },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["1", "3", "2"],
  );
});

test("cases page globally sorts the hydrated shard and favorites lists", () => {
  const source = readFileSync(new URL("../pages/CasesPage.tsx", import.meta.url), "utf8");

  assert.match(source, /sortCasesForDisplay\(candidates\)/);
});
