import assert from "node:assert/strict";
import test from "node:test";
import { chooseBestUpstreamSnapshot } from "./sync-source-selection.mjs";

test("upstream source selection prefers the freshest case snapshot", () => {
  const best = chooseBestUpstreamSnapshot([
    {
      origin: "cdn",
      casesPayload: { cases: [{ id: 1 }, { id: 2 }] },
      stylePayload: { templates: [] },
    },
    {
      origin: "raw",
      casesPayload: { cases: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      stylePayload: { templates: [] },
    },
  ]);

  assert.equal(best.origin, "raw");
});

test("upstream source selection uses max case id as the tie breaker", () => {
  const best = chooseBestUpstreamSnapshot([
    {
      origin: "stale",
      casesPayload: { cases: [{ id: 1 }, { id: 4 }] },
      stylePayload: { templates: [] },
    },
    {
      origin: "fresh",
      casesPayload: { cases: [{ id: 1 }, { id: 5 }] },
      stylePayload: { templates: [] },
    },
  ]);

  assert.equal(best.origin, "fresh");
});
