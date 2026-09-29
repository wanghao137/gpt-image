import assert from "node:assert/strict";
import test from "node:test";

import {
  storeBaseForCase,
  storeLocalUrlFor,
  storeKeysFor,
  bakeSourceCandidates,
  manifestUpsert,
  localisedShare,
} from "./build-images-core.mjs";

const xOriginalUrl = (src) => {
  const m = src.match(/media\/\d+_[A-Za-z0-9]+_([A-Za-z0-9_-]+)\.(jpe?g|png|webp)$/i);
  return m ? `https://pbs.twimg.com/media/${m[1]}?format=jpg&name=orig` : null;
};

test("storeBaseForCase / storeLocalUrlFor follow the /images/cases/<base> convention", () => {
  assert.equal(storeBaseForCase("100312"), "case100312");
  assert.equal(storeLocalUrlFor("case100312"), "/images/cases/case100312.jpg");
});

test("storeKeysFor enumerates canonical jpg + full webp ladder", () => {
  const keys = storeKeysFor("case1", [320, 480]);
  assert.equal(keys.jpg, "cases/case1.jpg");
  assert.deepEqual(keys.webp, ["cases/case1-320.webp", "cases/case1-480.webp"]);
});

test("bakeSourceCandidates prefers the X original, then the origin copy", () => {
  const youmind =
    "https://cms-assets.youmind.com/media/1788942288291_1ovagz_HRu3ie-bwAATJ-v.jpg";
  const cands = bakeSourceCandidates(youmind, xOriginalUrl);
  assert.equal(cands.length, 2);
  assert.equal(cands[0].kind, "x-orig");
  assert.equal(cands[0].url, "https://pbs.twimg.com/media/HRu3ie-bwAATJ-v?format=jpg&name=orig");
  assert.equal(cands[1].kind, "origin");
  assert.equal(cands[1].url, youmind);
});

test("bakeSourceCandidates falls back to origin-only for non-YouMind URLs", () => {
  const cands = bakeSourceCandidates("https://example.com/a.jpg", xOriginalUrl);
  assert.deepEqual(cands, [{ url: "https://example.com/a.jpg", kind: "origin" }]);
});

test("manifestUpsert is pure and accumulates entries", () => {
  const m0 = {};
  const m1 = manifestUpsert(m0, "case1", {
    widths: [480, 320], jpgBytes: 10, webpBytes: { 320: 1, 480: 2 }, source: "x-orig", bakedAt: "t1",
  });
  assert.notEqual(m0, m1);
  assert.deepEqual(m1.entries.case1.widths, [320, 480]);
  const m2 = manifestUpsert(m1, "case2", {
    widths: [960], jpgBytes: 5, webpBytes: { 960: 3 }, source: "origin", bakedAt: "t2",
  });
  assert.equal(m2.version, 1);
  assert.ok(m2.entries.case1);
  assert.ok(m2.entries.case2);
});

test("localisedShare counts /images/ and /uploads/ as local", () => {
  assert.equal(localisedShare([]), 1);
  assert.equal(
    localisedShare([
      { imageUrl: "/images/cases/case1.jpg" },
      { imageUrl: "/uploads/a.jpg" },
      { imageUrl: "https://cms-assets.youmind.com/media/1_a_b.jpg" },
    ]),
    2 / 3,
  );
});
