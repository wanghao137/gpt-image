import assert from "node:assert/strict";
import test from "node:test";

import {
  caseIdFromSlug,
  findCaseIndexEntry,
  findCaseInShard,
} from "./case-detail-resolution-core.mjs";

const index = [
  { id: "28659", slug: "di-xia-ting-che-chang-28659", uc: "storyboard", r: "3:1" },
];
const shard = [
  { id: "28659", slug: "di-xia-ting-che-chang-28659", title: "地下停车场追逐分镜脚本" },
];

test("caseIdFromSlug reads the stable numeric suffix", () => {
  assert.equal(caseIdFromSlug("old-english-title-28659"), "28659");
  assert.equal(caseIdFromSlug("missing-id"), undefined);
});

test("case index resolution survives a translated slug change", () => {
  assert.equal(findCaseIndexEntry(index, "old-english-title-28659"), index[0]);
});

test("shard resolution survives mixed old-index/new-shard cache versions", () => {
  assert.equal(findCaseInShard(shard, "old-english-title-28659", "28659"), shard[0]);
});
