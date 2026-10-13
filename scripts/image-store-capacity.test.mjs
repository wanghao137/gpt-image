import assert from "node:assert/strict";
import test from "node:test";

import {
  B2_FREE_TIER_BYTES,
  CAP_SAFETY_MARGIN_BYTES,
  EVICTABLE_WIDTHS,
  storeBudgetBytes,
  manifestBytes,
  evictionCandidates,
  planEviction,
  applyEvictionToEntry,
  evictionPoolStatus,
} from "./image-store-capacity.mjs";
import {
  isDeferredEntry,
  holdOutDeferredRecords,
  manifestUpsert,
} from "./build-images-core.mjs";

function entry(overrides = {}) {
  return {
    widths: [320, 480, 640, 960, 1280],
    jpgBytes: 100,
    webpBytes: { 320: 1, 480: 2, 640: 3, 960: 4, 1280: 5 },
    source: "x-orig",
    bakedAt: "2026-09-29T10:00:00.000Z",
    ...overrides,
  };
}

test("budget sits a safety margin under the decimal 10GB cap", () => {
  assert.equal(B2_FREE_TIER_BYTES, 10_000_000_000);
  assert.equal(storeBudgetBytes(), B2_FREE_TIER_BYTES - CAP_SAFETY_MARGIN_BYTES);
  assert.ok(storeBudgetBytes() < B2_FREE_TIER_BYTES);
});

test("manifestBytes sums jpg + all webp rungs and skips deferred entries", () => {
  const entries = {
    case1: entry(),
    case2: entry({ jpgBytes: 10, webpBytes: { 320: 1 } }),
    case3: entry({ deferred: true, jpgBytes: 999, webpBytes: { 1280: 999 } }),
    case4: entry({ webpBytes: {} }),
  };
  // case1: 100+15, case2: 10+1, case4: 100 — deferred case3 contributes 0.
  assert.equal(manifestBytes(entries), 115 + 11 + 100);
});

test("evictionCandidates lists only real 1280 rungs, oldest bakedAt first", () => {
  const entries = {
    new: entry({ bakedAt: "2026-10-10T00:00:00.000Z" }),
    old: entry({ bakedAt: "2026-09-29T10:00:00.000Z" }),
    duplicateSkipped: entry({ webpBytes: { 320: 1, 480: 2, 640: 3, 960: 4 } }),
    deferred: entry({ deferred: true }),
  };
  const cands = evictionCandidates(entries, EVICTABLE_WIDTHS[0]);
  assert.deepEqual(
    cands.map((c) => c.base),
    ["old", "new"],
  );
  assert.equal(cands[0].bytes, 5);
});

test("planEviction evicts oldest-first only until the need is covered", () => {
  const entries = {
    a: entry({ webpBytes: { 1280: 10 }, bakedAt: "2026-10-01T00:00:00.000Z" }),
    b: entry({ webpBytes: { 1280: 20 }, bakedAt: "2026-10-02T00:00:00.000Z" }),
    c: entry({ webpBytes: { 1280: 40 }, bakedAt: "2026-10-03T00:00:00.000Z" }),
  };
  const plan = planEviction(entries, 25);
  assert.deepEqual(
    plan.plan.map((p) => p.base),
    ["a", "b"],
  );
  assert.equal(plan.freed, 30);
  assert.equal(plan.exhausted, false);

  const drained = planEviction(entries, 1000);
  assert.equal(drained.exhausted, true);
  assert.equal(drained.freed, 70);
  assert.equal(drained.plan.length, 3);

  const none = planEviction(entries, 0);
  assert.deepEqual(none.plan, []);
  assert.equal(none.exhausted, false);
});

test("applyEvictionToEntry drops only the evicted rung", () => {
  const e = entry();
  applyEvictionToEntry(e, 1280);
  assert.deepEqual(e.widths, [320, 480, 640, 960]);
  assert.deepEqual(Object.keys(e.webpBytes).sort(), ["320", "480", "640", "960"]);
  assert.equal(e.jpgBytes, 100);
});

test("evictionPoolStatus reports the renewable pool", () => {
  const entries = {
    a: entry(),
    b: entry({ webpBytes: { 960: 4 } }),
    c: entry({ deferred: true }),
  };
  assert.deepEqual(evictionPoolStatus(entries, 1280), { rungs: 1, bytes: 5 });
});

test("isDeferredEntry is a narrow type guard", () => {
  assert.equal(isDeferredEntry({ deferred: true }), true);
  assert.equal(isDeferredEntry({}), false);
  assert.equal(isDeferredEntry(null), false);
  assert.equal(isDeferredEntry(undefined), false);
});

test("holdOutDeferredRecords removes exactly the deferred cases/templates", () => {
  const cases = [
    { id: "1", imageUrl: "https://cms-assets.youmind.com/media/a.jpg" },
    { id: "2", imageUrl: "/images/cases/case2.jpg" },
    { id: "3", imageUrl: "https://cms-assets.youmind.com/media/b.jpg" },
  ];
  const templates = [
    { id: "7", cover: "https://cms-assets.youmind.com/media/c.jpg" },
    { id: "8", cover: "/images/template8.jpg" },
  ];
  const entries = {
    case1: entry({ deferred: true }),
    // case2 is baked and published — must never be held out.
    case2: entry(),
    case3: entry({ deferred: true }),
    template7: entry({ deferred: true }),
  };
  const held = holdOutDeferredRecords({ cases, templates, entries });
  assert.deepEqual(held.cases.map((c) => c.id), ["2"]);
  assert.deepEqual(held.templates.map((t) => t.id), ["8"]);
  assert.deepEqual(held.heldOutCases, ["1", "3"]);
  assert.deepEqual(held.heldOutTemplates, ["7"]);
});

test("holdOutDeferredRecords keeps everything when entries are absent/healthy", () => {
  const cases = [{ id: "1", imageUrl: "/images/cases/case1.jpg" }];
  const held = holdOutDeferredRecords({ cases, templates: [], entries: {} });
  assert.equal(held.cases.length, 1);
  assert.deepEqual(held.heldOutCases, []);
});

test("a successful bake replaces a deferred marker wholesale (retry clears it)", () => {
  // The wiring under test: storeBakeOne retries deferred entries, and the
  // manifestUpsert on success must leave NO deferred marker behind — a stale
  // marker would hold an already-published case out of the site forever.
  let manifest = { version: 1, entries: { case1: { deferred: true, deferredAt: "t" } } };
  assert.equal(isDeferredEntry(manifest.entries.case1), true);
  manifest = manifestUpsert(manifest, "case1", {
    widths: [320, 960],
    jpgBytes: 5,
    webpBytes: { 320: 1, 960: 2 },
    source: "x-orig",
    bakedAt: "t2",
  });
  assert.equal(isDeferredEntry(manifest.entries.case1), false);
  assert.equal(manifest.entries.case1.jpgBytes, 5);
});
