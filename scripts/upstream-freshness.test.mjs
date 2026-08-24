import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { countRecentUpstreamCases } from "./upstream-freshness.mjs";

const NOW = Date.UTC(2026, 7, 24, 12, 0, 0);
const day = 24 * 60 * 60 * 1000;
const row = (id, iso) => ({ id, createdAt: iso });

describe("countRecentUpstreamCases", () => {
  it("counts only upstream ids within the window", () => {
    const rows = [
      row(32000, new Date(NOW - day).toISOString()),
      row(32001, new Date(NOW - 5 * day).toISOString()),
      row(32002, new Date(NOW - 20 * day).toISOString()),
      row(100123, new Date(NOW - day).toISOString()), // manual range excluded
      row(32003, "not-a-date"),
    ];
    assert.equal(countRecentUpstreamCases(rows, NOW, 7), 2);
  });
  it("tolerates non-array input", () => {
    assert.equal(countRecentUpstreamCases(null, NOW, 7), 0);
  });
});
