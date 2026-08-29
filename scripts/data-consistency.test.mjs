import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test, { describe, it } from "node:test";

import {
  validateGeneratedData,
  validateGeneratedDataDirectory,
  validateLabData,
} from "./data-consistency-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function fixture() {
  const sourceCases = [
    { id: "1" },
    { id: "2" },
  ];
  return {
    sourceCases,
    home: {
      totalCount: 2,
      hero: [{ id: "1" }],
      strip: [{ id: "2" }],
      featured: sourceCases,
      initial: sourceCases,
    },
    index: sourceCases,
    search: sourceCases,
    categoryShards: [
      { name: "cases-a.json", records: [{ id: "1" }] },
      { name: "cases-b.json", records: [{ id: "2" }] },
    ],
  };
}

test("generated datasets cover the canonical case id set", () => {
  assert.deepEqual(validateGeneratedData(fixture()), {
    caseCount: 2,
    categoryShardCount: 2,
  });
});

test("generated datasets reject missing search records", () => {
  const data = fixture();
  data.search = [{ id: "1" }];
  assert.throws(() => validateGeneratedData(data), /cases-search\.json differs/);
});

test("generated datasets reject an incomplete category union", () => {
  const data = fixture();
  data.categoryShards = [{ name: "cases-a.json", records: [{ id: "1" }] }];
  assert.throws(() => validateGeneratedData(data), /category shard union differs/);
});

test("checked-in generated data matches the canonical source", () => {
  const dataDir = resolve(__dirname, "../public/data");
  const result = validateGeneratedDataDirectory(dataDir);
  assert.ok(result.caseCount > 0);
  assert.ok(result.categoryShardCount > 0);
});

describe("validateLabData schema gate", () => {
  const valid = (over = {}) => ({
    id: "abc", slug: "20260828-abc", title: "t", createdAt: "2026-08-28T09:06:37.735Z",
    prompt: "p", promptPreview: "p", cosKey: "lab/2026/08/abc.png",
    width: 2400, height: 3200, model: "gpt-image-2",
    ...over,
  });

  it("accepts a valid registry", () => {
    assert.equal(validateLabData([valid()]).count, 1);
  });

  it("rejects non-array, missing fields, bad dims, bad cosKey, dup ids", () => {
    assert.throws(() => validateLabData({}));
    assert.throws(() => validateLabData([valid({ prompt: "" })]));
    assert.throws(() => validateLabData([valid({ width: 0 })]));
    assert.throws(() => validateLabData([valid({ cosKey: "uploads/x.png" })]));
    assert.throws(() => validateLabData([valid(), valid({ slug: "20260829-abc", cosKey: "lab/2026/08/abc.png" })]));
  });

  it("hidden entries still validate (they only drop out of shards)", () => {
    assert.equal(validateLabData([valid({ hidden: true })]).count, 1);
  });
});
