import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertUpstreamNotShrunk,
  UpstreamShrinkError,
} from "./upstream-shrink-guard.mjs";

describe("assertUpstreamNotShrunk", () => {
  it("allows growth over the cached set", () => {
    const r = assertUpstreamNotShrunk({ fetchedCount: 16000, cachedCount: 15949 });
    assert.equal(r.ok, true);
  });

  it("allows a small drop within the default 10% tolerance", () => {
    // floor = floor(15949 * 0.9) = 14354
    const r = assertUpstreamNotShrunk({ fetchedCount: 14354, cachedCount: 15949 });
    assert.equal(r.floor, 14354);
  });

  it("throws UpstreamShrinkError below the floor", () => {
    assert.throws(
      () => assertUpstreamNotShrunk({ fetchedCount: 14353, cachedCount: 15949 }),
      UpstreamShrinkError,
    );
  });

  it("skips the check on a fresh install (empty cache)", () => {
    const r = assertUpstreamNotShrunk({ fetchedCount: 0, cachedCount: 0 });
    assert.equal(r.ok, true);
  });

  it("honors a custom minRatio override", () => {
    assert.doesNotThrow(() =>
      assertUpstreamNotShrunk({ fetchedCount: 8000, cachedCount: 15949, minRatio: "0.5" }),
    );
  });

  it("rejects an invalid ratio", () => {
    assert.throws(() =>
      assertUpstreamNotShrunk({ fetchedCount: 10, cachedCount: 100, minRatio: "1.5" }),
    );
  });
});
