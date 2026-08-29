import assert from "node:assert/strict";
import test from "node:test";
import {
  LAB_FOLDER_RE,
  parseArchiveFolder,
  deriveTitle,
  derivePromptPreview,
  buildCosKey,
  buildSlugId,
  mergeLabEntries,
} from "./lab-core.mjs";

const META = (over = {}) => ({
  taskId: "mtcq9c871afnv",
  createdAt: "2026-08-28T09:06:37.735Z",
  prompt:
    "提示词：\n【GPT Image2プロンプト】\n\n主題：\n陽だまりに閉じる瞳\n\n主体：\n人物は画面中央に大きく置く。",
  params: { transparent_output: false, quality: "high" },
  actualSize: { width: 2400, height: 3200 },
  api: { model: "gpt-image-2" },
  images: [{ file: "image-1.png", width: 2400, height: 3200 }],
  ...over,
});

test("folder regex matches generation dirs and rejects collection dirs", () => {
  assert.ok(LAB_FOLDER_RE.test("2026-08-28_17-06-37_2400x3200_GPT Image2プロンプト】 主題"));
  assert.ok(!LAB_FOLDER_RE.test("meigen"));
  assert.ok(!LAB_FOLDER_RE.test("batches/batch_x"));
});

test("parseArchiveFolder builds entries with slug/cosKey/title", () => {
  const r = parseArchiveFolder("2026-08-28_17-06-37_2400x3200_x", META());
  assert.equal(r.skip, undefined);
  assert.equal(r.entries.length, 1);
  const e = r.entries[0];
  assert.equal(e.id, "mtcq9c871afnv");
  assert.equal(e.slug, "20260828-mtcq9c871afnv");
  assert.equal(e.title, "陽だまりに閉じる瞳");
  assert.equal(e.cosKey, "lab/2026/08/mtcq9c871afnv.png");
  assert.equal(e.width, 2400);
  assert.equal(e.model, "gpt-image-2");
  assert.equal(e.quality, "high");
  assert.ok(e.prompt.length > 0);
  assert.ok(e.promptPreview.length > 0);
});

test("transparent sticker folders are skipped entirely", () => {
  const r = parseArchiveFolder("2026-08-24_10-11-30_2880x2880_x", META({ params: { transparent_output: true } }));
  assert.equal(r.skip, "transparent");
  assert.equal(r.entries.length, 0);
});

test("non-matching folder names are skipped", () => {
  const r = parseArchiveFolder("meigen", META());
  assert.equal(r.skip, "name");
});

test("multi-image folders expand with -N suffix from image index", () => {
  const meta = META({
    images: [
      { file: "image-1.png", width: 2400, height: 3200 },
      { file: "image-2.png", width: 2400, height: 3200 },
    ],
  });
  const r = parseArchiveFolder("2026-08-28_17-06-37_2400x3200_x", meta);
  assert.deepEqual(r.entries.map((e) => e.id), ["mtcq9c871afnv", "mtcq9c871afnv-2"]);
  assert.deepEqual(
    r.entries.map((e) => e.cosKey),
    ["lab/2026/08/mtcq9c871afnv.png", "lab/2026/08/mtcq9c871afnv-2.png"],
  );
});

test("deriveTitle falls back through 主題 → first line → date", () => {
  assert.equal(deriveTitle("主題： 紅い壁\n其余", "2026-08-28T00:00:00Z"), "紅い壁");
  assert.equal(deriveTitle("主题： 红墙\n其余", "2026-08-28T00:00:00Z"), "红墙");
  assert.equal(deriveTitle("plain first line here\nsecond", "2026-08-28T00:00:00Z"), "plain first line here");
  assert.equal(deriveTitle("", "2026-08-28T00:00:00Z"), "4K 生成 · 2026-08-28");
});

test("deriveTitle skips 提示词/bracket headers and clips to 40 chars", () => {
  assert.equal(deriveTitle("提示词：\n【GPT Image2プロンプト】\n实际第一行", "2026-08-28T00:00:00Z"), "实际第一行");
  assert.ok(deriveTitle("主題： " + "長".repeat(80), "2026-08-28T00:00:00Z").length <= 40);
});

test("deriveTitle falls back to date for meaningless titles", () => {
  assert.equal(deriveTitle("生成同款图", "2026-08-28T00:00:00Z"), "4K 生成 · 2026-08-28");
  assert.equal(deriveTitle('{"style":"photo"}', "2026-08-28T00:00:00Z"), "4K 生成 · 2026-08-28");
  assert.equal(deriveTitle("{", "2026-08-28T00:00:00Z"), "4K 生成 · 2026-08-28");
  assert.equal(deriveTitle("朝", "2026-08-28T00:00:00Z"), "4K 生成 · 2026-08-28");
});

test("derivePromptPreview flattens whitespace and clips", () => {
  const p = derivePromptPreview("a\n\nb   c\n" + "x".repeat(200), 10);
  assert.ok(p.endsWith("…"));
  assert.ok(p.length <= 11);
  assert.ok(!p.includes("\n"));
});

test("buildSlugId and buildCosKey zero-pad month", () => {
  assert.deepEqual(buildSlugId("abc", 2, "2026-08-28T09:06:37Z"), { id: "abc-2", slug: "20260828-abc-2" });
  assert.equal(buildCosKey("abc-2", "2026-08-28T09:06:37Z"), "lab/2026/08/abc-2.png");
});

test("mergeLabEntries preserves existing entries verbatim and appends new sorted", () => {
  const existing = [{ id: "b", createdAt: "2026-08-02T00:00:00Z", title: "人工改的标题", hidden: true }];
  const incoming = [
    { id: "a", createdAt: "2026-08-01T00:00:00Z" },
    { id: "c", createdAt: "2026-08-03T00:00:00Z" },
    { id: "b", createdAt: "2026-08-02T00:00:00Z", title: "导入器版本" },
  ];
  const merged = mergeLabEntries(existing, incoming);
  assert.deepEqual(
    merged.map((e) => e.id),
    ["a", "b", "c"],
  );
  assert.equal(merged[1].title, "人工改的标题");
  assert.equal(merged[1].hidden, true);
});
