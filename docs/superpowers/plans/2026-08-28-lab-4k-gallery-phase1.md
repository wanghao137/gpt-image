# 「4K 实验室」Phase 1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `/lab` 板块，把本地 522 张 4K 生图（COS 原图 + 完整 Prompt）以预渲染详情页 + 分片瀑布流索引的形式上站。

**Architecture:** 原图存腾讯 COS HK（`lab/` 前缀，公读），缩略图由 imageMogr2 实时派生；仓库只追踪 `data/manual/lab.json` 登记表（prompt+参数+COS 键）；构建链新增 `build-lab-data.mjs` 产出分片；SSG 侧直读 lab.json 预渲染全部详情页；客户端永不打包全量数据。

**Tech Stack:** Node 20 原生脚本（cos-nodejs-sdk-v5、dotenv）、Vite + React 18 + vite-react-ssg、node --test。

**Spec:** `docs/superpowers/specs/2026-08-28-lab-4k-gallery-design.md`

## Global Constraints

- **禁止自动 commit/push/deploy**（AGENTS.md 红线）。计划中的验证步骤替代提交步骤；全部完成后向用户请示提交方式。
- 中文 JSON 一律 Node fs UTF-8 写入；密钥只在 `.env.local`，不入库、不入聊天、不入日志。
- 导入脚本只扫描档案根目录下 `^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_` 文件夹，不递归；`params.transparent_output === true` 的表情包文件夹整体跳过。
- 客户端 bundle 不得静态引入 `data/manual/lab.json`（只能 SSG 侧引用）；分片遵循现有 revision 模式。
- 每个任务完成后跑 `npm run check`（或任务内指定的最小测试子集），Phase 1 收尾跑 `npm run check && npm run build`。
- 外链图片 URL 含 `imageMogr2` 时必须直连 COS，禁止走 wsrv（CN 性能）。
- LabItem `hidden: true` 不进任何公开产物（分片/sitemap/路由）。

## 关键接口约定（全任务共享）

```ts
// src/types.ts 新增
export interface LabItem {
  id: string;          // taskId；多图第 N 张 `${taskId}-${N}`（N≥2）
  slug: string;        // `${YYYYMMDD}-${id}`
  title: string;       // 导入时启发式生成；人工改后导入器保留
  createdAt: string;   // metadata.createdAt ISO
  prompt: string;
  promptPreview: string;
  cosKey: string;      // lab/yyyy/mm/<id>.png
  width: number; height: number;
  model: string;       // gpt-image-2
  quality?: string;
  hidden?: boolean;
}
```

```js
// src/lib/lab-cos-core.mjs（构建脚本与运行时共用，纯函数无依赖）
export const COS_PUBLIC_BASE = "https://gpt-image-2-1259488227.cos.ap-hongkong.myqcloud.com";
export function labImageUrl(cosKey, width, quality = 78) {
  return `${COS_PUBLIC_BASE}/${cosKey}?imageMogr2/thumbnail/${width}x/format/webp/q/${quality}`;
}
export function labOriginalUrl(cosKey) { return `${COS_PUBLIC_BASE}/${cosKey}`; }
```

分片产物（`scripts/build-lab-data.mjs` 生成，均含 `revision` 时间无关哈希）：
- `public/data/lab-home.json`：`{ items: LiteItem[48], totalCount, pageCount, pageSize, revision }`（双模静态导入，镜像 cases-home.json）
- `public/data/lab/browse/page-000.json`…：`LiteItem[]` 每页 48，时间倒序；page-000 与 lab-home.items 相同
- `public/data/lab-index.json`：`[{id,slug}]`（SPA 路由查找）
- `public/data/lab/prompts/<slug>.json`：完整 LabItem（去 hidden 字段）+ `detail`/`lightbox` URL
- `LiteItem = { id, slug, t(title), d(createdAt), w, h, thumb }`

---

### Task 1: `scripts/lab-core.mjs` — 解析与合并纯函数

**Files:**
- Create: `scripts/lab-core.mjs`
- Test: `scripts/lab-core.test.mjs`

**Interfaces:**
- Produces: `LAB_FOLDER_RE`、`parseArchiveFolder(name, meta, imageFiles)`、`deriveTitle(prompt, createdAtISO)`、`derivePromptPreview(prompt, len=120)`、`buildCosKey(id, createdAtISO)`、`mergeLabEntries(existing, incoming)`、`buildSlugId(taskId, imageIndex, createdAtISO)`

- [ ] **Step 1: 写失败测试** `scripts/lab-core.test.mjs`

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  LAB_FOLDER_RE, parseArchiveFolder, deriveTitle, derivePromptPreview,
  buildCosKey, buildSlugId, mergeLabEntries,
} from "./lab-core.mjs";

const META = (over = {}) => ({
  taskId: "mtcq9c871afnv",
  createdAt: "2026-08-28T09:06:37.735Z",
  prompt: "提示词：\n【GPT Image2プロンプト】\n\n主題：\n陽だまりに閉じる瞳\n\n主体：\n人物は画面中央に大きく置く。",
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
});

test("transparent sticker folders are skipped entirely", () => {
  const r = parseArchiveFolder("2026-08-24_10-11-30_2880x2880_x", META({ params: { transparent_output: true } }));
  assert.equal(r.skip, "transparent");
  assert.equal(r.entries.length, 0);
});

test("multi-image folders expand with -N suffix from image index", () => {
  const meta = META({ images: [
    { file: "image-1.png", width: 2400, height: 3200 },
    { file: "image-2.png", width: 2400, height: 3200 },
  ]});
  const r = parseArchiveFolder("2026-08-28_17-06-37_2400x3200_x", meta);
  assert.deepEqual(r.entries.map((e) => e.id), ["mtcq9c871afnv", "mtcq9c871afnv-2"]);
});

test("deriveTitle falls back through 主題 → first line → date", () => {
  assert.equal(deriveTitle("主題： 紅い壁\n其余", "2026-08-28T00:00:00Z"), "紅い壁");
  assert.equal(deriveTitle("plain first line here\nsecond", "2026-08-28T00:00:00Z"), "plain first line here");
  assert.equal(deriveTitle("", "2026-08-28T00:00:00Z"), "4K 生成 · 2026-08-28");
});

test("deriveTitle clips to 40 chars", () => {
  assert.ok(deriveTitle("主題： " + "長".repeat(80), "2026-08-28T00:00:00Z").length <= 40);
});

test("buildCosKey zero-pads month and uses id", () => {
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
  assert.deepEqual(merged.map((e) => e.id), ["a", "b", "c"]);
  assert.equal(merged[1].title, "人工改的标题");
  assert.equal(merged[1].hidden, true);
});
```

- [ ] **Step 2: 跑测试确认失败** — `node --test scripts/lab-core.test.mjs` → FAIL（模块不存在）

- [ ] **Step 3: 实现 `scripts/lab-core.mjs`**

```js
/** Lab archive parsing + merge core. Pure functions, no fs/network — fully testable. */
export const LAB_FOLDER_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_/;

export function buildSlugId(taskId, imageIndex, createdAtISO) {
  const d = new Date(createdAtISO);
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const id = imageIndex > 1 ? `${taskId}-${imageIndex}` : taskId;
  return { id, slug: `${ymd}-${id}` };
}

export function buildCosKey(id, createdAtISO) {
  const d = new Date(createdAtISO);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `lab/${d.getUTCFullYear()}/${mm}/${id}.png`;
}

export function deriveTitle(prompt, createdAtISO) {
  const text = String(prompt || "").trim();
  const m = text.match(/^(?:主題|主题)\s*[：:]\s*(.+)/m);
  let raw = m ? m[1] : "";
  if (!raw) {
    const lines = text.split(/\r?\n/).map((l) => l.trim())
      .filter((l) => l && !/^(提示词|プロンプト|prompt)\s*[：:]?$/i.test(l) && !/^【.+】[：:]?$/.test(l));
    raw = lines[0] || "";
  }
  if (!raw) return `4K 生成 · ${createdAtISO.slice(0, 10)}`;
  return raw.replace(/\s+/g, " ").trim().slice(0, 40);
}

export function derivePromptPreview(prompt, len = 120) {
  const flat = String(prompt || "").replace(/\s+/g, " ").trim();
  return flat.length > len ? flat.slice(0, len) + "…" : flat;
}

/** folderName+metadata → entries. Skip reason in `.skip` when the folder must not be imported. */
export function parseArchiveFolder(folderName, meta) {
  if (!LAB_FOLDER_RE.test(folderName)) return { skip: "name", entries: [] };
  if (meta?.params?.transparent_output === true) return { skip: "transparent", entries: [] };
  const images = Array.isArray(meta?.images) && meta.images.length > 0
    ? meta.images : [{ file: "image-1.png" }];
  const entries = images.map((img, i) => {
    const { id, slug } = buildSlugId(meta.taskId, i + 1, meta.createdAt);
    return {
      id, slug,
      title: deriveTitle(meta.prompt, meta.createdAt),
      createdAt: meta.createdAt,
      prompt: meta.prompt,
      promptPreview: derivePromptPreview(meta.prompt),
      cosKey: buildCosKey(id, meta.createdAt),
      width: meta.actualSize?.width ?? img.width ?? 0,
      height: meta.actualSize?.height ?? img.height ?? 0,
      model: meta.api?.model ?? "gpt-image-2",
      quality: meta.params?.quality,
    };
  });
  return { entries };
}

/** existing wins verbatim (protects hidden + manual title edits); result sorted by createdAt asc. */
export function mergeLabEntries(existing, incoming) {
  const byId = new Map();
  for (const e of existing) byId.set(e.id, e);
  for (const e of incoming) if (!byId.has(e.id)) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
```

- [ ] **Step 4: 跑测试确认全过** — `node --test scripts/lab-core.test.mjs` → PASS

---

### Task 2: `scripts/import-lab.mjs` — 导入脚本（doctor / dry-run / 正式）

**Files:**
- Create: `scripts/import-lab.mjs`
- Modify: `package.json`（scripts 加 `"lab:import": "node scripts/import-lab.mjs"`）

**Interfaces:**
- Consumes: Task 1 全部函数；`.env.local` 的 `COS_BUCKET/COS_REGION/COS_SECRET_ID/COS_SECRET_KEY/LAB_ARCHIVE_DIR`；`data/manual/lab.json`（可不存在 → 视为 `[]`）
- Produces: 追加/创建 `data/manual/lab.json`；COS 对象 `lab/**`（公读、immutable 缓存头）

- [ ] **Step 1: 实现脚本**（要点逐条落实；网络操作只在本脚本）

```js
/**
 * Idempotent 4K-lab importer.
 *   node scripts/import-lab.mjs --doctor   # 预检：密钥/桶/公读链路（写一个探针对象再删）
 *   node scripts/import-lab.mjs --dry-run  # 列出将导入的条目，零写入
 *   node scripts/import-lab.mjs            # 上传新增 + 合并写回 lab.json
 * 上传后逐对象匿名 GET 验证公读；任一失败 → 非零退出且不写 lab.json。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import COS from "cos-nodejs-sdk-v5";
import { parseArchiveFolder, mergeLabEntries } from "./lab-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadDotenv({ path: resolve(ROOT, ".env.local") });

const BUCKET = process.env.COS_BUCKET, REGION = process.env.COS_REGION;
const SID = process.env.COS_SECRET_ID, SKEY = process.env.COS_SECRET_KEY;
const ARCHIVE = process.env.LAB_ARCHIVE_DIR;
const LAB_JSON = resolve(ROOT, "data/manual/lab.json");
const args = new Set(process.argv.slice(2));
const cos = new COS({ SecretId: SID, SecretKey: SKEY });
const call = (fn, p) => new Promise((res, rej) => fn.call(cos, p, (e, d) => (e ? rej(e) : res(d))));
const md5 = (buf) => createHash("md5").update(buf).digest("hex");

function requireEnv() {
  const missing = ["COS_BUCKET", "COS_REGION", "COS_SECRET_ID", "COS_SECRET_KEY", "LAB_ARCHIVE_DIR"]
    .filter((k) => !process.env[k]);
  if (missing.length) { console.error(`缺少环境变量: ${missing.join(", ")}（写入 .env.local）`); process.exit(1); }
  if (!existsSync(ARCHIVE)) { console.error(`LAB_ARCHIVE_DIR 不存在: ${ARCHIVE}`); process.exit(1); }
}

async function doctor() {
  requireEnv();
  await call(cos.headBucket, { Bucket: BUCKET, Region: REGION });
  console.log("1. headBucket PASS");
  const Key = "lab/_doctor_probe.txt";
  await call(cos.putObject, { Bucket: BUCKET, Region: REGION, Key, Body: "probe", ContentType: "text/plain", ACL: "public-read" });
  console.log("2. putObject+public-read PASS");
  const r = await fetch(`https://${BUCKET}.cos.${REGION}.myqcloud.com/${Key}`);
  if (!(r.status === 200 && (await r.text()) === "probe")) throw new Error(`匿名读失败 status=${r.status}`);
  console.log("3. anonymous GET PASS");
  await call(cos.deleteObject, { Bucket: BUCKET, Region: REGION, Key });
  console.log("4. cleanup PASS — doctor 全绿");
}

function scanArchive() {
  const out = [];
  for (const name of readdirSync(ARCHIVE)) {
    const dir = join(ARCHIVE, name);
    let st; try { st = statSync(dir); } catch { continue; }
    if (!st.isDirectory()) continue;
    const metaPath = join(dir, "metadata.json");
    if (!existsSync(metaPath)) continue;
    let meta; try { meta = JSON.parse(readFileSync(metaPath, "utf8")); } catch (e) { console.warn(`跳过(元数据损坏): ${name}`); continue; }
    const { entries, skip } = parseArchiveFolder(name, meta);
    if (skip === "transparent") { console.log(`跳过(表情包透明底): ${name}`); continue; }
    if (skip) continue;
    for (let i = 0; i < entries.length; i++) out.push({ entry: entries[i], file: join(dir, meta.images?.[i]?.file ?? `image-${i + 1}.png`) });
  }
  return out; // 档案内全量候选（含已导入的，diff 在后面）
}

async function run() {
  requireEnv();
  const existing = existsSync(LAB_JSON) ? JSON.parse(readFileSync(LAB_JSON, "utf8")) : [];
  const known = new Set(existing.map((e) => e.id));
  const candidates = scanArchive().filter((c) => !known.has(c.entry.id));
  console.log(`档案候选 ${candidates.length} 条（已登记 ${existing.length} 条跳过）`);
  if (candidates.length === 0) { console.log("无新增。"); return; }
  if (args.has("--dry-run")) {
    for (const { entry } of candidates) console.log(`  ${entry.createdAt.slice(0, 10)}  ${entry.width}x${entry.height}  ${entry.title}  → ${entry.cosKey}`);
    console.log(`dry-run：共 ${candidates.length} 条，未做任何写入。`);
    return;
  }
  let uploaded = 0, failed = 0;
  const newEntries = [];
  for (const { entry, file } of candidates) {
    const buf = readFileSync(file);
    const remote = await call(cos.getObject, { Bucket: BUCKET, Region: REGION, Key: entry.cosKey }).catch(() => null);
    if (remote && remote.headers?.etag?.replace(/"/g, "") === md5(buf)) { newEntries.push(entry); uploaded += 0; console.log(`  已存在  ${entry.cosKey}`); continue; }
    try {
      await call(cos.putObject, {
        Bucket: BUCKET, Region: REGION, Key: entry.cosKey, Body: buf,
        ContentType: "image/png", ContentLength: buf.length, ACL: "public-read",
        CacheControl: "public, max-age=31536000, immutable",
      });
      const check = await fetch(`https://${BUCKET}.cos.${REGION}.myqcloud.com/${entry.cosKey}`, { method: "HEAD" });
      if (check.status !== 200) throw new Error(`匿名 HEAD status=${check.status}`);
      newEntries.push(entry); uploaded += 1;
      console.log(`  上传    ${entry.cosKey}  ${(buf.length / 1048576).toFixed(1)}MB  ${entry.title}`);
    } catch (e) { failed += 1; console.error(`  FAILED  ${entry.cosKey}: ${e.message || e}`); }
  }
  if (failed > 0) { console.error(`${failed} 条失败，lab.json 未写入（重跑只补缺）。`); process.exit(1); }
  const merged = mergeLabEntries(existing, newEntries);
  writeFileSync(LAB_JSON, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(`完成：上传 ${uploaded}、跳过 ${candidates.length - uploaded}、lab.json 共 ${merged.length} 条。`);
}

if (args.has("--doctor")) doctor().catch((e) => { console.error("doctor FAIL:", e.message || e); process.exit(1); });
else run().catch((e) => { console.error(e.message || e); process.exit(1); });
```

注意：getObject 拉整图比对 etag 会下载 11MB——改为 `cos.headObject` 取 ETag 比对（实现时把 `getObject` 换成 `headObject`，`data.headers.etag`；分块上传时 ETag 非 md5，比对失败即重传，安全幂等）。

- [ ] **Step 2: doctor 验证** — `npm run lab:import -- --doctor` → 4 项 PASS（密钥已就位，预期直接绿）

- [ ] **Step 3: dry-run 清单** — `npm run lab:import -- --dry-run` → 输出 522 条清单 + 6 条表情包跳过日志；**把清单尾部 20 行贴给用户过目**（内容把关，含人像类）

- [ ] **Step 4: 全量导入**（用户对清单点头后）— `npm run lab:import` → `data/manual/lab.json` 522 条；`node -e "console.log(require('./data/manual/lab.json').length)"` 确认

---

### Task 3: `scripts/build-lab-data.mjs` — 分片生成 + prebuild 接线

**Files:**
- Create: `scripts/build-lab-data.mjs`
- Create: `src/lib/lab-cos-core.mjs`（见全局接口约定，构建与运行时共用）
- Modify: `package.json`（`predev`/`prebuild` 在 `split-data.mjs` 之后追加 `&& node scripts/build-lab-data.mjs`）
- Test: `scripts/build-lab-data.test.mjs`

**Interfaces:**
- Consumes: `data/manual/lab.json`、`lab-cos-core.mjs`
- Produces: `public/data/lab-home.json`、`public/data/lab/browse/page-NNN.json`、`public/data/lab-index.json`、`public/data/lab/prompts/<slug>.json`（结构见「关键接口约定」；`thumb = labImageUrl(cosKey, 640)`）

- [ ] **Step 1: 写失败测试**（fixture 数组 → 断言 hidden 过滤、倒序分页、prompts 分片内容、revision 存在且确定性）

```js
import assert from "node:assert/strict";
import test from "node:test";
import { buildLabShards } from "./build-lab-data.mjs";
// buildLabShards(items) 是纯函数：输入 LabItem[]，返回 { home, pages, index, prompts }
// home.items[0] 是最新条目；pages 每页 ≤48；hidden 条目不出现在任何产物。

const items = [
  { id: "a", slug: "20260801-a", title: "A", createdAt: "2026-08-01T00:00:00Z", prompt: "pa", promptPreview: "pa", cosKey: "lab/2026/08/a.png", width: 2400, height: 3200 },
  { id: "b", slug: "20260802-b", title: "B", createdAt: "2026-08-02T00:00:00Z", prompt: "pb", promptPreview: "pb", cosKey: "lab/2026/08/b.png", width: 2160, height: 3840 },
  { id: "h", slug: "20260803-h", title: "H", createdAt: "2026-08-03T00:00:00Z", prompt: "ph", promptPreview: "ph", cosKey: "lab/2026/08/h.png", width: 2400, height: 3200, hidden: true },
];

test("hidden items are excluded everywhere; newest first; pagination", () => {
  const s = buildLabShards(items);
  assert.deepEqual(s.home.items.map((i) => i.id), ["b", "a"]);
  assert.equal(s.home.totalCount, 2);
  assert.ok(!JSON.stringify(s).includes('"ph"'));
  assert.equal(s.pages.length, Math.ceil(2 / 48));
});

test("lite rows carry thumb url; prompts shard carries full item + detail url", () => {
  const s = buildLabShards(items);
  assert.match(s.home.items[0].thumb, /imageMogr2\/thumbnail\/640x\/format\/webp/);
  assert.equal(s.prompts["20260802-b"].prompt, "pb");
  assert.match(s.prompts["20260802-b"].detail, /thumbnail\/1600x/);
});

test("index lists id+slug of visible items", () => {
  const s = buildLabShards(items);
  assert.deepEqual(s.index, [{ id: "b", slug: "20260802-b" }, { id: "a", slug: "20260801-a" }]);
});
```

- [ ] **Step 2: 跑测试确认失败** — `node --test scripts/build-lab-data.test.mjs` → FAIL

- [ ] **Step 3: 实现 `scripts/build-lab-data.mjs`** — `buildLabShards(items)` 纯函数（导出供测试）：过滤 `hidden` → `createdAt` 倒序 → 切片 48/页 → lite 行 `{id,slug,t,d,w,h,thumb}`；`prompts[slug] = {...item 去除 hidden, detail: labImageUrl(cosKey,1600,82), lightbox: labImageUrl(cosKey,2160,85)}`；`revision = sha256(JSON.stringify(visibleSorted)).slice(0,12)`。main()：读 `data/manual/lab.json` → 调 `buildLabShards` → 写 4 类产物到 `public/data/`（`writeJson` 镜像 split-data.mjs：`JSON.stringify(data)`、UTF-8、`lab-home.json` 用 `JSON.stringify(home)`）。lab.json 不存在时写空集合并 log（不让全新 clone 的构建失败）。

- [ ] **Step 4: 跑测试确认全过** — `node --test scripts/build-lab-data.test.mjs` → PASS

- [ ] **Step 5: 接线 package.json 并跑一次** — `predev`/`prebuild` 追加 `&& node scripts/build-lab-data.mjs`；手动 `node scripts/build-lab-data.mjs` → `ls public/data/lab/browse | wc -l` = ceil(522/48)=11、`ls public/data/lab/prompts | wc -l` = 522

---

### Task 4: 类型 + `src/lib/data-lab.ts` 双模数据层 + img 直出规则

**Files:**
- Modify: `src/types.ts`（追加 `LabItem`，见全局约定）
- Create: `src/lib/data-lab-ssg.ts`
- Create: `src/lib/data-lab.ts`
- Create: `src/lib/lab-cos-core.mjs`（Task 3 已建则跳过）
- Modify: `src/lib/img.ts`（`transformUrl` 对含 `imageMogr2` 的 URL 原样返回）
- Modify: `src/components/SmartImg.tsx`（`imageMogr2` URL 走直连路径，不包 wsrv）
- Test: `src/lib/img-lab.test.mjs`

**Interfaces:**
- Produces: `LAB_ITEMS: LabItem[]`（SSG 全量 / client 恒 `[]`）、`LAB_HOME`（双模静态导入 lab-home.json）、`loadLabBrowsePage(page): Promise<LabLite[]>`、`loadLabIndex(): Promise<{id,slug}[]>`、`loadLabItem(slug): Promise<LabItem|null>`（client：index 定位 → fetch `lab/prompts/<slug>.json`）、`getLabNeighbors(slug)`（SSG 用）

- [ ] **Step 1: 实现 data-lab.ts / data-lab-ssg.ts**（镜像 data.ts / data-ssg.ts 模式）

`data-lab-ssg.ts`：
```ts
import labJson from "../../data/manual/lab.json";
import type { LabItem } from "../types";
export const SSG_LAB_ITEMS: LabItem[] = (labJson as LabItem[]).filter((i) => !i.hidden);
```

`data-lab.ts`：静态 `import labHome from "../../public/data/lab-home.json"`；`if (import.meta.env.SSR) { const m = await import("./data-lab-ssg"); SSG_LAB_ITEMS = m.SSG_LAB_ITEMS; }`；`loadLabBrowsePage` 镜像 `loadBrowsePage`（URL 前缀 `data/lab/browse/page-NNN.json`，`?v=${labHome.revision}`，缓存 + inflight 去重）；`loadLabItem`、`loadLabIndex` 同理（`data/lab-index.json`）。

- [ ] **Step 2: img.ts 直出规则 + 测试**

```ts
// transformUrl 开头追加（现有 "/" 判断之前）：
if (src.includes("imageMogr2")) return src; // COS 预变换 URL：直连，禁 wsrv（CN 性能）
```
SmartImg：`const isPresetCdn = src.includes("imageMogr2");` → 并入 `isOtherSameOrigin` 的三个使用点（fallbackSrc / jpegSrcSet / markErrored 的 directFallback 分支判断），效果 = 该 URL 原样直出。

`src/lib/img-lab.test.mjs`（node --test，import 编译产物不可行 → 用源码断言模式，镜像 brand-surfaces.test.mjs）：
```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
test("transformUrl passes imageMogr2 URLs through untouched", () => {
  const src = readFileSync("src/lib/img.ts", "utf8");
  assert.match(src, /imageMogr2[\s\S]{0,80}return src/);
});
test("SmartImg treats imageMogr2 URLs as direct", () => {
  const src = readFileSync("src/components/SmartImg.tsx", "utf8");
  assert.match(src, /imageMogr2/);
});
```

- [ ] **Step 3: 验证** — `node --test src/lib/img-lab.test.mjs` PASS；`npx tsc -b` 无新错

---

### Task 5: `/lab` 索引页 + 路由 + 导航

**Files:**
- Create: `src/pages/LabPage.tsx`
- Create: `src/components/LabGrid.tsx`（瀑布流：`columns-2 sm:columns-3 lg:columns-4` + `break-inside-avoid`，`aspectRatio: w/h` 占位）
- Modify: `src/routes.tsx`（`{ path: "lab", Component: LabPage, entry: "src/pages/LabPage.tsx" }`，置于 cases 之后）
- Modify: `src/components/Header.tsx`（`NAV` 数组加 `{ to: "/lab", label: "4K 实验室", accent: true }`；移动端导航同步——搜 `NAV.map` 的第二处使用，确认移动端也用同一数组）
- Test: `src/pages/lab-page.test.mjs`（源码断言：路由已注册、NAV 含 /lab、LabPage 不静态引入 data/manual/lab.json）

- [ ] **Step 1: LabPage 实现**（结构要点）：`<SEO title="4K 实验室" description="桃子AI视觉实验室的 GPT-Image 2 4K 原生生图档案：完整 Prompt、参数与 4K 原图下载，持续更新。" path="/lab" />`；首屏 = `LAB_HOME.items`（SSG 内联 48 张）；「加载更多」按钮 `onClick` → `loadLabBrowsePage(pageCount)` 追加 state（初始 `pageCount=1`，加载到 `LAB_HOME.pageCount` 隐藏按钮）；卡片 = `LabGrid` 内 `Link to={/lab/${slug}}` 包 SmartImg（`src={thumb}`、`width/height` 传 aspect、`preserveAspectRatio`）+ 底部 title/日期/尺寸徽标；顶栏显示 `LAB_HOME.totalCount` 总数。

- [ ] **Step 2: 路由 + 导航接线**（如上文件清单）

- [ ] **Step 3: 测试 + 验证** — `node --test src/pages/lab-page.test.mjs` PASS；`npm run dev` 手开 `http://localhost:5173/lab` 肉眼确认瀑布流出图（COS 缩略图直连、无 wsrv）

---

### Task 6: `/lab/:slug` 详情页

**Files:**
- Create: `src/pages/LabDetailPage.tsx`
- Modify: `src/routes.tsx`（`{ path: "lab/:slug", ..., getStaticPaths: () => SSG_LAB_ITEMS.map(i => `/lab/${i.slug}`) }`——注意 routes.tsx 现有 import 来自 `./lib/data`，新增 `import { SSG_LAB_ITEMS } from "./lib/data-lab-ssg"` 直接用 SSG 模块，避免误触 client 分支）
- Test: `src/pages/lab-detail.test.mjs`（源码断言：getStaticPaths 用 SSG_LAB_ITEMS、含 下载原图 链接构造、SEO og:image 用 1200 变体）

- [ ] **Step 1: LabDetailPage 实现**（结构要点）：
  - SSG 直渲染：`const item = SSG_LAB_ITEMS.find(i => i.slug === slug)`（SSR 分支）；client SPA 到达时走 `loadLabItem(slug)`（loading 态镜像 CaseDetailLoading 的骨架样式，简版即可）
  - `<SEO type="article" title={item.title} description={item.promptPreview} path={`/lab/${item.slug}`} image={labImageUrl(item.cosKey, 1200)} preloadFetch={[`data/lab/prompts/${item.slug}.json`]} />`
  - 主图：SmartImg `src={labImageUrl(item.cosKey, 1600, 82)}`，`style={{aspectRatio: w/h}}`，点击 → `ImageLightbox`（传 `labImageUrl(item.cosKey, 2160, 85)`；读 ImageLightbox 现有 props 后对接）
  - Prompt 全文块：复用 `useCopy` 的复制按钮交互样式；`<pre>` 白空间保留
  - 参数芯片：`${width}×${height}`、`model`、`quality`、`createdAt.toLocaleDateString("zh-CN")`
  - 「下载 4K 原图」：`<a href={labOriginalUrl(item.cosKey)} download target="_blank" rel="noopener">`（约 xx MB 文案不写死，省维护）
  - 上一张/下一张：`getLabNeighbors(slug)` 返回相邻 slug，`<Link>` 导航
- [ ] **Step 2: 测试 + 构建** — `node --test src/pages/lab-detail.test.mjs` PASS；`npm run build` 成功且 `ls dist/lab | head` 出现 522 个 slug 目录（构建时长记录下来）

---

### Task 7: sitemap + SitemapPage 接线

**Files:**
- Modify: `scripts/build-sitemap-core.mjs`（`STATIC_PATHS` 加 `{ path: "/lab", priority: "0.8" }`；读 `public/data/lab-index.json`（存在时）追加每条 `/lab/<slug>` priority 0.6、lastmod 取构建日；lab.json 缺失/空时不报错）
- Modify: `src/pages/SitemapPage.tsx`（若有分节列表，加「4K 实验室」入口链接——先读该页确认结构再插）
- Modify: `scripts/build-sitemap-core.test.mjs`（加断言：lab-index 存在时 URL 列表含 `/lab` 与 lab slug）

- [ ] **Step 1: 实现接线** — 如上
- [ ] **Step 2: 测试** — `node --test scripts/build-sitemap-core.test.mjs` PASS

---

### Task 8: 数据一致性校验 + 全量验收

**Files:**
- Modify: `scripts/data-consistency-core.mjs`（或 check-data-consistency 的实际核心文件——先读再改）：新增 `validateLabData(items)`：数组、id/slug 唯一且 slug 匹配 `^\d{8}-.+-?\d*$`、必填字符串字段（id/slug/title/createdAt/prompt）非空、width/height 为正整数、cosKey 匹配 `^lab/\d{4}/\d{2}/[^/]+\.png$`；`npm run data:check` 接线
- Test: 扩展现有 data-consistency 测试文件

- [ ] **Step 1: 校验实现 + 测试** — `npm run data:check` 对当前 lab.json（522 条）通过
- [ ] **Step 2: 全量验收** — `npm run check` 全绿；`npm run build` 成功；`npm run dev` 浏览器走查清单：
  - `/lab` 首屏 48 张瀑布流出图（无 wsrv：devtools network 里缩略图请求直指 `*.myqcloud.com`）
  - 加载更多可翻到末页，总数 522
  - 任一详情页：主图/灯箱/复制 prompt/参数芯片/下载原图/前后导航可用
  - Header 桌面+移动导航均有「4K 实验室」
  - `dist/sitemap.xml` 含 `/lab` 与 522 个 lab slug
  - hidden 条目不在任何页面出现（导入后手动把某条加 `hidden: true` 跑 `node scripts/build-lab-data.mjs` 验证，再还原）
- [ ] **Step 3: 汇报 + 请示提交** — 汇总变更文件清单与走查结果给用户；按 AGENTS.md 请示是否分任务 commit（lab-core / import / build+data / 前端 / sitemap+check 分批）。

---

## Self-Review 结论

- **Spec 覆盖**：§5.1 数据模型→Task 1/4；§5.2 导入→Task 2；§5.3 URL→lab-cos-core+Task 4 直出；§5.4 页面/导航/SEO→Task 5/6/7；§5.5 构建集成→Task 3/8；hidden→Task 1/3/8；表情包排除→Task 1/2。§5.6（admin/晋升）与 Phase 2/3 明确不在本计划。
- **占位符**：无 TBD；Task 6/7 两处「先读现有组件/页面再对接」是对既有代码的必要勘察步骤，接口名与行为已定死。
- **类型一致**：LabItem/LiteItem/labImageUrl 命名全计划一致；`buildLabShards` 在 Task 3 定义、Task 3 测试直接消费。
- **一处 spec 细化**：spec §5.3 说「URL 烘焙进数据」，实现改为共享 `lab-cos-core.mjs` 纯函数（构建与渲染同源生成 URL），shard 更小、无重复 URL 数据；效果等同（前端零转换、直连 COS）。
