import assert from "node:assert/strict";
import test from "node:test";
import { buildLabShards } from "./build-lab-data.mjs";
import { labOriginalUrl } from "../src/lib/lab-cos-core.mjs";

// buildLabShards(items) 是纯函数：输入 LabItem[]，返回 { home, pages, index, prompts }
// home.items[0] 是最新条目；pages 每页 ≤48；hidden 条目不出现在任何产物。

const items = [
  { id: "a", slug: "20260801-a", title: "A", createdAt: "2026-08-01T00:00:00Z", prompt: "pa", promptPreview: "pa", cosKey: "lab/2026/08/a.png", width: 2400, height: 3200 },
  { id: "b", slug: "20260802-b", title: "B", createdAt: "2026-08-02T00:00:00Z", prompt: "pb", promptPreview: "pb", cosKey: "lab/2026/08/b.png", width: 2160, height: 3840 },
  { id: "h", slug: "20260803-h", title: "H", createdAt: "2026-08-03T00:00:00Z", prompt: "ph", promptPreview: "ph", cosKey: "lab/2026/08/h.png", width: 2400, height: 3200, hidden: true },
];

test("hidden items are excluded everywhere; newest first; pagination", () => {
  const s = buildLabShards(items);
  assert.deepEqual(
    s.home.items.map((i) => i.id),
    ["b", "a"],
  );
  assert.equal(s.home.totalCount, 2);
  assert.ok(!JSON.stringify(s).includes('"ph"'));
  assert.ok(!JSON.stringify(s).includes("20260803-h"));
  assert.equal(s.pages.length, Math.ceil(2 / 48));
});

test("lite rows carry thumb url and compact fields; home mirrors page-000", () => {
  const s = buildLabShards(items);
  const row = s.home.items[0];
  assert.equal(row.id, "b");
  assert.equal(row.t, "B");
  assert.equal(row.d, "2026-08-02T00:00:00Z");
  assert.equal(row.w, 2160);
  assert.equal(row.h, 3840);
  // fixture ids have no baked file → R2-original fallback (COS emptied 2026-08-30)
  assert.equal(row.thumb, labOriginalUrl("lab/2026/08/b.png"));
  assert.deepEqual(s.pages[0][0].id, "b");
});

test("prompts shard carries full item (minus hidden) + urls; missing baked file falls back to R2 original", () => {
  const s = buildLabShards(items);
  assert.equal(s.prompts["20260802-b"].prompt, "pb");
  // no baked file for fixture ids → R2 original fallback
  assert.equal(s.prompts["20260802-b"].detail, labOriginalUrl("lab/2026/08/b.png"));
  assert.equal(s.prompts["20260802-b"].lightbox, s.prompts["20260802-b"].detail);
  assert.match(s.prompts["20260802-b"].orig, /\/b\.png$/);
  assert.equal(s.prompts["20260802-b"].hidden, undefined);
  assert.equal(s.prompts["20260803-h"], undefined);
  assert.equal(s.urls["20260802-b"].og, s.prompts["20260802-b"].detail);
});

test("index lists id+slug of visible items newest-first", () => {
  const s = buildLabShards(items);
  assert.deepEqual(s.index, [
    { id: "b", slug: "20260802-b" },
    { id: "a", slug: "20260801-a" },
  ]);
});

test("revision is deterministic for identical input", () => {
  assert.equal(buildLabShards(items).home.revision, buildLabShards(items).home.revision);
  assert.ok(buildLabShards(items).home.revision.length >= 8);
});
