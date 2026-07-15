import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCaseHydrationData,
  serializeCaseHydrationData,
} from "./case-hydration-core.mjs";

test("case hydration data round-trips for the matching slug", () => {
  const value = {
    caseData: { id: "28659", slug: "current-28659", title: "地下停车场" },
    related: [],
  };
  assert.deepEqual(
    parseCaseHydrationData(serializeCaseHydrationData(value), value.caseData.slug),
    value,
  );
});

test("case hydration data rejects stale route content", () => {
  const value = { caseData: { id: "28659", slug: "current-28659" }, related: [] };
  assert.equal(parseCaseHydrationData(JSON.stringify(value), "another-28658"), undefined);
});

test("case hydration serialization prevents script tag breakout", () => {
  const text = serializeCaseHydrationData({
    caseData: { slug: "safe-1", title: "</script><script>bad()</script>" },
    related: [],
  });
  assert.doesNotMatch(text, /<\/script>/i);
  assert.match(text, /\\u003c\/script\\u003e/);
});
