# TaoStudio P0/Wave-1 优化执行方案（Implementation Plan）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复审计确认的三个 P0（sitemap 与真实页面集合不一致、CI 不产一致性产物也不跑测试、上游缩水可静默删库），并落地两个高杠杆快赢（sitemap 单一来源化、上游断供告警），使「sitemap ⊆ 返回完整 HTML 的 URL」成为被测试锁住的不变量。

**Architecture:** 全部在现有 Vite + vite-react-ssg 静态导出架构内完成。核心思路：不为 16K 案例页扩 SSG（构建超时是真实约束），而是在 postbuild 阶段为未预渲染的案例批量生成「带完整 SEO 头部的 SPA 引导壳」（复用 6.3KB 的 `dist/spa/index.html` 作模板，注入 title/canonical/OG/JSON-LD/noscript 正文摘要）。数据管线侧给 sync 加数量下限熔断，CI 补 split-data 再生与 `npm run check` 门禁，sitemap 分类/模板改为从 dist 实际产物扫描派生。

**Tech Stack:** Node ≥20 ESM 脚本（`node:test` 测试）、GitHub Actions、Vercel 静态部署（cleanUrls）、现有 `src/lib/seo-url.mjs` 工具函数。

## Global Constraints（摘自 AGENTS.md，每个任务默认继承）

- 环境：Windows + Git Bash；Node ≥20；写中文 JSON/Markdown 一律用工具文件写入，**禁止 PowerShell 文本写入**。
- 只做本地 commit；**未经用户明确要求不 push、不部署**。内容类提交与配置/工作流清理分开提交。
- 中文文案质量保持现有水准；不得虚构 URL/路径。
- 每个 Task 收尾必须 `npm run check` 绿；Wave 结束加跑 `npm run build`。
- 验证一律以构建产物（dist/静态应用）为准，不以源 JSON 为准。
- 本机克隆可能落后远端：**任何任务开始前若发现与 origin/main 分叉，先停下重新评估**（Task 1 已内置同步步骤）。
- 测试风格遵循仓库现状：`node:test` + `*.test.mjs` 与被测脚本同目录；核心逻辑抽成无 IO 的 `*-core.mjs` 纯模块再接线（现有模式）。

---

### Task 1: 同步本地仓库并修复已提交的生成数据漂移

**Files:**
- Modify: `public/data/*`（仅由脚本再生产物，不手改）

**Interfaces:**
- Produces: 一棵 `npm run check` 全绿的干净基线；后续所有任务以此为起点。

- [ ] **Step 1: 同步远端**

```bash
git fetch origin
git rev-list --left-right --count main...origin/main   # 记录输出
git pull --ff-only origin main                          # 若报分叉则停止并向用户报告
```

Expected: 快进合并成功；落后量归零。

- [ ] **Step 2: 确认红色基线（预期失败）**

```bash
npm ci            # 若 node_modules 已存在可跳过
npm run check
```

Expected: FAIL —— `checked-in generated data matches the canonical source`，错误信息形如 `cases-index.json differs from cases.json (missing NNNN: …)`。记录 missing 数量作为修复证据。（若意外全绿，说明上游已自行修复，跳过 Step 3，仍执行 Step 4。）

- [ ] **Step 3: 重跑分片生成器对齐产物**

```bash
node scripts/migrate-v2.mjs
node scripts/split-data.mjs
git status --porcelain -- public/data | head -20
```

Expected: `public/data/cases-index.json` 及相关分片出现改动。

- [ ] **Step 4: 验证全绿并提交**

```bash
npm run check
```

Expected: PASS（226+ tests, 0 fail）。

```bash
git add public/data
git commit -m "data(sync): realign committed shards/index with cases.json"
```

---

### Task 2: sync.mjs 上游缩水熔断（P0-3）

**Files:**
- Create: `scripts/upstream-shrink-guard.mjs`
- Create: `scripts/upstream-shrink-guard.test.mjs`
- Modify: `scripts/sync.mjs`（try 块内 `await enrichNewCaseRatios(...)` 之后）

**Interfaces:**
- Consumes: 无（独立纯模块）。
- Produces: `assertUpstreamNotShrunk({ fetchedCount, cachedCount, minRatio }) -> { ok: true, floor }`，缩水时抛 `UpstreamShrinkError`；`minRatio` 缺省 0.9，来自 `SYNC_MIN_UPSTREAM_RATIO` 环境变量。

- [ ] **Step 1: 写失败测试**

创建 `scripts/upstream-shrink-guard.test.mjs`：

```js
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
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node --test scripts/upstream-shrink-guard.test.mjs
```

Expected: FAIL，`Cannot find module .../upstream-shrink-guard.mjs`。

- [ ] **Step 3: 最小实现**

创建 `scripts/upstream-shrink-guard.mjs`：

```js
/**
 * Guards against a partial upstream response silently wiping the library.
 * sync.mjs trusts any valid manifest, so a truncated category file would make
 * thousands of cases vanish AND their prompt files be deleted as "orphans".
 * The floor converts suspicious shrinkage into the same failure path as a
 * fully dead upstream: hard-fail in CI, cached-snapshot fallback under
 * --optional.
 */
export class UpstreamShrinkError extends Error {
  constructor(message) {
    super(message);
    this.name = "UpstreamShrinkError";
  }
}

export function assertUpstreamNotShrunk({ fetchedCount, cachedCount, minRatio }) {
  const ratio = minRatio == null ? 0.9 : Number(minRatio);
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
    throw new Error(`invalid minRatio: ${minRatio}`);
  }
  if (!Number.isFinite(cachedCount) || cachedCount <= 0) {
    return { ok: true, floor: 0 };
  }
  const floor = Math.floor(cachedCount * ratio);
  if (fetchedCount < floor) {
    throw new UpstreamShrinkError(
      `upstream shrank suspiciously: fetched ${fetchedCount} cases < floor ${floor} ` +
        `(${Math.round(ratio * 100)}% of cached ${cachedCount}); refusing to overwrite public/data`,
    );
  }
  return { ok: true, floor };
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test scripts/upstream-shrink-guard.test.mjs
```

Expected: PASS（6 tests）。

- [ ] **Step 5: 接线进 sync.mjs**

`scripts/sync.mjs` 顶部 import 区加入：

```js
import { assertUpstreamNotShrunk } from "./upstream-shrink-guard.mjs";
```

`main()` 中找到（唯一出现处）：

```js
    await enrichNewCaseRatios(upstreamCases, cachedCaseById);
```

其后紧接插入：

```js
    // A partial upstream response must never wipe the committed library.
    // Throwing here lands in the catch below: hard-fail without --optional,
    // cached-snapshot fallback with it.
    assertUpstreamNotShrunk({
      fetchedCount: upstreamCases.length,
      cachedCount: Array.from(cachedCaseById.values()).filter(
        (item) => Number(item.id) < 100000,
      ).length,
      minRatio: process.env.SYNC_MIN_UPSTREAM_RATIO,
    });
```

语义验证要点（无需新测试，靠现有行为保证）：抛出的 `UpstreamShrinkError` 落入既有 `catch` → 非 optional 模式进程 exit 1（CI 红）；`--optional` 模式走缓存回退分支（`upstreamOk=false`，prompt 文件保留）。

- [ ] **Step 6: 回归验证**

```bash
node --test scripts/upstream-shrink-guard.test.mjs
SYNC_MIN_UPSTREAM_RATIO=1.01 npm run sync --optional ; echo "exit=$?"
```

Expected: 单测 PASS；第二条因比率非法在上游成功抓取后抛错、optional 模式降级为缓存构建并以 exit 0 结束（日志含 `built ... from cached snapshot`）。随后清掉临时状态：

```bash
git checkout -- public/data data/upstream-locales.json 2>/dev/null || true
```

- [ ] **Step 7: 提交**

```bash
git add scripts/upstream-shrink-guard.mjs scripts/upstream-shrink-guard.test.mjs scripts/sync.mjs
git commit -m "fix(sync): abort when upstream shrinks below 90% of the cached library"
```

---

### Task 3: CI 补分片再生 + `npm run check` 门禁（P0-2 流程面）

**Files:**
- Modify: `.github/workflows/content.yml`（migrate 步骤后、重试分支两处）
- Modify: `.github/workflows/sync.yml`（同上两处）

**Interfaces:**
- Consumes: Task 1 修复后的绿色基线。
- Produces: 远端 Actions 提交的 `public/data/*` 自洽；主分支不再可能带红合入。

- [ ] **Step 1: 改 content.yml**

在 `- name: Apply v2 field migrations` / `run: npm run migrate` 之后插入：

```yaml
      - name: Regenerate derived shards
        # sync rewrites public/data/cases.json but not the shards/index/search
        # files; without this step the checked-in artifacts drift apart and
        # data-consistency.test.mjs fails (root cause of the long-red main).
        run: node scripts/split-data.mjs

      - name: Verify (typecheck + tests)
        # Gate: do not commit/push regenerated data that fails the suite.
        run: npm run check
```

在重试分支内（`git reset --hard origin/main` 之后的）`run: npm run migrate` 行后追加一行（同缩进）：

```yaml
            node scripts/split-data.mjs
```

- [ ] **Step 2: 对 sync.yml 做同样三处插入**

`- name: Apply v2 field migration` 后插入与 Step 1 相同的两个步骤（注释文字沿用）；重试分支同样追加 `node scripts/split-data.mjs`。

- [ ] **Step 3: 本地等价序列演练**

```bash
npm run migrate && node scripts/split-data.mjs && npm run check
git status --porcelain -- public/data
```

Expected: 三条命令全部成功；status 为空（Task 1 之后幂等无 diff）——证明工作流里将执行的命令序列有效。

- [ ] **Step 4: 提交**

```bash
git add .github/workflows/content.yml .github/workflows/sync.yml
git commit -m "ci: regenerate split artifacts and gate data pushes on npm run check"
```

注：workflow 语法无法本地执行验证；靠 Step 3 序列演练 + 推送后首次运行观察（推送由用户决定时机）。

---

### Task 4: sitemap 分类/模板从 dist 实际产物派生（P1-6）

**Files:**
- Modify: `scripts/build-sitemap-core.mjs`
- Modify: `scripts/build-sitemap-core.test.mjs`（追加用例）
- Modify: `scripts/build-sitemap.mjs`（透传 distDir，若尚未透传）

**Interfaces:**
- Consumes: `generateSitemapXml({ cases, today, siteUrl, distDir? })` 新增可选 `distDir`；`buildSitemap` 内部把自身 `distDir` 传入。
- Produces: 分类/模板 URL 集合 = dist 中真实存在的预渲染页面集合（无 dist 时退回旧逻辑：分类用静态表、模板不列）。这是「sitemap ⊆ 真实页面」不变量的第一块拼图（案例部分由 Task 5 补齐）。

- [ ] **Step 1: 写失败测试**

`scripts/build-sitemap-core.test.mjs` 追加：

```js
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// …文件顶部已有 imports 保持不动，以下追加到文件末尾的测试区

describe("sitemap derives categories/templates from prerendered dist", () => {
  const gameAssetRegression = { userCategory: "game-asset", slug: "ga-case", createdAt: "2026-08-01" };

  it("lists game-asset and templates when their pages exist in dist", () => {
    const root = mkdtempSync(join(tmpdir(), "sm-"));
    try {
      const cat = join(root, "dist", "category");
      mkdirSync(join(cat, "xhs-cover"), { recursive: true });
      mkdirSync(join(cat, "game-asset"), { recursive: true });
      const tpl = join(root, "dist", "template");
      mkdirSync(join(tpl, "tmpl-9"), { recursive: true });
      const xml = generateSitemapXml({
        cases: [gameAssetRegression],
        today: "2026-08-24",
        distDir: join(root, "dist"),
      });
      assert(xml.includes("/category/game-asset<"), "game-asset must be listed");
      assert(xml.includes("/category/xhs-cover<"), "prerendered category listed");
      assert(xml.includes("/template/tmpl-9<"), "prerendered template listed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("without dist falls back to static list and omits templates", () => {
    const xml = generateSitemapXml({ cases: [gameAssetRegression], today: "2026-08-24" });
    assert(!xml.includes("/category/game-asset<"), "fallback list has no game-asset");
    assert(!xml.includes("/template/"), "no template urls without dist");
    assert(!xml.includes("/case/ga-case<"), "slugless-source cases stay data-driven"); 
    // 注：该用例的 case 有 slug，会照常列出——此行应为 assert(xml.includes("/case/ga-case<"))
  });
});
```

（执行时注意：第二个用例最后一行按实际行为修正为 `assert(xml.includes("/case/ga-case<"))`——案例循环本就不受 dist 影响，此断言用于锁定这一点。）

- [ ] **Step 2: 跑测试确认失败**

```bash
node --test scripts/build-sitemap-core.test.mjs
```

Expected: 新增第一个用例 FAIL（当前实现不接收 distDir，game-asset 不在列表）。

- [ ] **Step 3: 实现**

`scripts/build-sitemap-core.mjs`：

① fs import 增加 `readdirSync`：

```js
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
```

② 新增函数（放在 `caseMatchesCategory` 之后）：

```js
/** Slugs that actually have a prerendered page: dist/<segment>/<slug>/index.html or .html. */
function collectPrerendered(distDir, segment) {
  const slugs = new Set();
  const dir = resolve(distDir, segment);
  if (!existsSync(dir)) return slugs;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) slugs.add(entry.name);
    else if (entry.isFile() && entry.name.endsWith(".html")) {
      slugs.add(entry.name.replace(/\.html$/, ""));
    }
  }
  return slugs;
}
```

③ `createSitemapEntries({ cases, today, siteUrl })` 改签名为 `(…, distDir)`，分类与模板段替换为：

```js
  // Invariant: sitemap lists exactly the URLs that ship as real pages. When
  // dist exists we scan it (single source of truth); otherwise fall back to
  // the static category table and omit templates rather than guess.
  const prerenderedCategories = distDir
    ? collectPrerendered(distDir, "category")
    : null;
  if (prerenderedCategories) {
    for (const slug of [...prerenderedCategories].sort()) {
      entries.push(urlEntry({ loc: `/category/${slug}`, lastmod: today, priority: "0.8", siteUrl }));
    }
  } else {
    for (const slug of USER_CATEGORY_SLUGS) {
      if (!sourceCases.some((item) => caseMatchesCategory(item, slug))) continue;
      entries.push(urlEntry({ loc: `/category/${slug}`, lastmod: today, priority: "0.8", siteUrl }));
    }
  }

  if (distDir) {
    const templates = collectPrerendered(distDir, "template");
    for (const id of [...templates].sort()) {
      entries.push(urlEntry({ loc: `/template/${id}`, lastmod: today, priority: "0.7", siteUrl }));
    }
  }
```

案例循环保持原样。④ `generateSitemapXml` 增加 `distDir` 参数并透传；`buildSitemap` 在两处 `createSitemapEntries(...)` 调用中传 `distDir`。⑤ 检查 `build-sitemap.mjs` 包装层无需改动（其默认参数已含 distDir）。

- [ ] **Step 4: 跑测试确认通过 + 回归**

```bash
node --test scripts/build-sitemap-core.test.mjs
```

Expected: 全部 PASS（含既有用例，特别是「无 dist 也写出 sitemap」那条）。

- [ ] **Step 5: 提交**

```bash
git add scripts/build-sitemap-core.mjs scripts/build-sitemap-core.test.mjs
git commit -m "fix(seo): derive sitemap categories/templates from prerendered pages"
```

---

### Task 5: 未预渲染案例的元页面生成器（P0-1 核心）

**Files:**
- Create: `scripts/case-meta-pages-core.mjs`（纯函数）
- Create: `scripts/case-meta-pages-core.test.mjs`
- Create: `scripts/build-case-meta-pages.mjs`（CLI，只写 dist，不入库 public/）
- Modify: `package.json` 的 `postbuild` 脚本

**Interfaces:**
- Consumes: `src/lib/seo-url.mjs` 的 `absoluteUrl(siteUrl, pathOrUrl)`、`clipText(value, max)`、`jsonLdSafeStringify(data)`；`scripts/build-sitemap-core.mjs` 的 `SITE_URL`；`dist/spa/index.html` 模板（含 `</head>` 与 `<div id="root"></div>` 锚点，实测存在）；`public/data/cases.json` lite 行字段（id/title/category/imageUrl/promptPreview/createdAt/slug…）。
- Produces: `buildCaseMetaHtml({ spaHtml, row, siteUrl? }) -> string | null`（缺 slug/title 返回 null）；dist 下新增 `dist/case/<slug>.html`（仅限未被 SSG 覆盖的 slug）。**不改** `vercel.json` 的 `/case/:slug* → /spa` 重写——它保留为兜底（未知垃圾 slug 仍是软 404，属已知残留，见 Wave 2）。

设计依据（第一性原理）：sitemap 契约要求每个列出的 URL 返回带正确信号的真实 HTML。全量 SSG 需 15 分钟级构建且有超时风险；而爬虫需要的只是头部信号 + 可读正文摘要。用 6.3KB 壳 × 字符串替换，15K 页构建秒级完成，CDN 直接静态服务，零运行时成本。

- [ ] **Step 1: 写失败测试**

创建 `scripts/case-meta-pages-core.test.mjs`：

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCaseMetaHtml } from "./case-meta-pages-core.mjs";

const SPA = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>占位标题</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

const ROW = {
  id: "100123",
  slug: "test-case-100123",
  title: "赛博朋克城市夜景",
  category: "场景与叙事",
  imageUrl: "/uploads/city.jpg",
  promptPreview: "A neon-lit cyberpunk cityscape at night <script>alert(1)</script>",
  createdAt: "2026-08-20T10:00:00.000Z",
};

describe("buildCaseMetaHtml", () => {
  it("injects title, canonical, og tags and JSON-LD before </head>", () => {
    const html = buildCaseMetaHtml({ spaHtml: SPA, row: ROW });
    assert.match(html, /<title>赛博朋克城市夜景 \| 桃子AI视觉实验室<\/title>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/taostudioai\.com\/case\/test-case-100123" \/>/);
    assert.match(html, /<meta property="og:title"/);
    assert.match(html, /<script type="application\/ld\+json">/);
    assert.ok(html.indexOf("og:title") < html.indexOf("</head>"));
  });

  it("escapes html-sensitive characters in titles and descriptions", () => {
    const html = buildCaseMetaHtml({ spaHtml: SPA, row: ROW });
    assert(!html.includes("<script>alert(1)</script>"), "raw script must not survive");
    assert(html.includes("&lt;script&gt;"), "escaped form present");
  });

  it("promotes a relative imageUrl to an absolute og:image", () => {
    const html = buildCaseMetaHtml({ spaHtml: SPA, row: ROW });
    assert.match(html, /<meta property="og:image" content="https:\/\/taostudioai\.com\/uploads\/city\.jpg" \/>/);
  });

  it("keeps the SPA bootstrap intact and adds exactly one noscript summary", () => {
    const html = buildCaseMetaHtml({ spaHtml: SPA, row: ROW });
    assert.match(html, /<div id="root"><\/div>/);
    assert.equal(html.split("<noscript>").length - 1, 1);
    assert.equal(html.split("</html>").length - 1, 1);
  });

  it("is deterministic (byte-stable across runs)", () => {
    assert.equal(buildCaseMetaHtml({ spaHtml: SPA, row: ROW }), buildCaseMetaHtml({ spaHtml: SPA, row: ROW }));
  });

  it("returns null without slug or title", () => {
    assert.equal(buildCaseMetaHtml({ spaHtml: SPA, row: { ...ROW, slug: "" } }), null);
    assert.equal(buildCaseMetaHtml({ spaHtml: SPA, row: { ...ROW, title: "" } }), null);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node --test scripts/case-meta-pages-core.test.mjs
```

Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现核心模块**

创建 `scripts/case-meta-pages-core.mjs`：

```js
import { absoluteUrl, clipText, jsonLdSafeStringify } from "../src/lib/seo-url.mjs";
import { SITE_URL } from "./build-sitemap-core.mjs";

export { SITE_URL };

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

const HEAD_SUFFIX = "\n  </head>";
const ROOT_ANCHOR = '<div id="root"></div>';

/**
 * Build a crawlable variant of the SPA shell for one case: identical body
 * bootstrap, enriched <head>, plus a <noscript> content summary so the
 * page's unique text exists without JS execution.
 * Returns null for rows that cannot produce a sane page.
 */
export function buildCaseMetaHtml({ spaHtml, row, siteUrl = SITE_URL }) {
  const slug = String(row?.slug ?? "").trim();
  const title = String(row?.title ?? "").trim();
  if (!slug || !title) return null;

  const pageUrl = `${siteUrl}/case/${slug}`;
  const description =
    clipText(String(row?.promptPreview ?? "").replace(/\s+/g, " ").trim(), 150) ||
    `${title} — GPT-Image 提示词案例`;
  const ogImage = absoluteUrl(siteUrl, String(row?.imageUrl ?? ""));
  const createdAt = String(row?.createdAt ?? "").slice(0, 10);

  const jsonLd = jsonLdSafeStringify({
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: title,
    description,
    url: pageUrl,
    ...(ogImage ? { contentUrl: ogImage } : {}),
    ...(createdAt ? { datePublished: createdAt } : {}),
  });

  const headTags = [
    `<title>${escapeHtml(title)} | 桃子AI视觉实验室</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`,
    '<meta property="og:type" content="article" />',
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    ...(ogImage
      ? [`<meta property="og:image" content="${escapeHtml(ogImage)}" />`]
      : []),
    `<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}" />`,
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join("\n    ");

  if (!spaHtml.includes("</head>") || !spaHtml.includes(ROOT_ANCHOR)) {
    throw new Error("spa shell is missing </head> or #root anchor — template drift");
  }

  return spaHtml
    .replace("</head>", `${headTags}${HEAD_SUFFIX}`)
    .replace(ROOT_ANCHOR, `${ROOT_ANCHOR}\n    <noscript><p>${escapeHtml(description)}</p></noscript>`);
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test scripts/case-meta-pages-core.test.mjs
```

Expected: PASS（6 tests）。若 `seo-url.mjs` 导出名不符（以 `grep "^export"` 输出为准：`absoluteUrl/clipText/jsonLdSafeStringize` 均已确认存在），修正 import 而非改测试语义。

- [ ] **Step 5: 实现 CLI**

创建 `scripts/build-case-meta-pages.mjs`：

```js
#!/usr/bin/env node
// Generates crawlable meta pages for every case slug that vite-react-ssg did
// NOT prerender. Runs in postbuild (after sitemap), reads the fresh spa shell
// from dist/, and writes ONLY into dist/ — these are deploy artifacts, never
// committed sources.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCaseMetaHtml } from "./case-meta-pages-core.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");

const spaPath = resolve(DIST, "spa", "index.html");
if (!existsSync(spaPath)) {
  console.error(`✗ ${spaPath} not found — run after vite-react-ssg build.`);
  process.exit(1);
}
const spaHtml = readFileSync(spaPath, "utf8");

const rows = JSON.parse(readFileSync(resolve(ROOT, "public", "data", "cases.json"), "utf8"));
if (!Array.isArray(rows)) {
  console.error("✗ public/data/cases.json is not an array");
  process.exit(1);
}

const prerendered = new Set();
const caseDir = resolve(DIST, "case");
if (existsSync(caseDir)) {
  for (const entry of readdirSync(caseDir, { withFileTypes: true })) {
    if (entry.isDirectory()) prerendered.add(entry.name);
    else if (entry.isFile() && entry.name.endsWith(".html")) {
      prerendered.add(entry.name.replace(/\.html$/, ""));
    }
  }
}

let written = 0;
let alreadyRich = 0;
let skipped = 0;
for (const row of rows) {
  const slug = typeof row?.slug === "string" ? row.slug.trim() : "";
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    skipped += 1;
    continue;
  }
  if (prerendered.has(slug)) {
    alreadyRich += 1;
    continue;
  }
  const html = buildCaseMetaHtml({ spaHtml, row });
  if (!html) {
    skipped += 1;
    continue;
  }
  const out = resolve(caseDir, `${slug}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  written += 1;
}

console.log(
  `✓ case meta pages: ${written} written, ${alreadyRich} already prerendered, ` +
    `${skipped} skipped (missing/unsafe slug or title)`,
);
```

- [ ] **Step 6: 接线 postbuild**

`package.json`：

```json
  "postbuild": "node scripts/build-sitemap.mjs && node scripts/build-404.mjs && node scripts/build-case-meta-pages.mjs",
```

- [ ] **Step 7: 全量构建验证**

```bash
npm run build
find dist/case -name "*.html" -maxdepth 1 | wc -l
SLUG=$(node -e "const c=require('./public/data/cases.json');const s=c.filter(r=>r.slug);console.log(s[s.length-50].slug)")
echo "$SLUG" && grep -oE "<title>[^<]*</title>" "dist/case/$SLUG.html" && grep -c 'rel="canonical"' "dist/case/$SLUG.html"
```

Expected: 构建成功且日志含 `✓ case meta pages: NNNN written`；html 数 ≈ 总案例数 − SSG 数(800)；尾部 slug 文件含 `<title>` 且 canonical 计数为 1。同时抽查一个**已被 SSG 预渲染**的头部 slug 目录未被破坏：`ls dist/case/ | head -3` 结构如常。

- [ ] **Step 8: 提交**

```bash
git add scripts/case-meta-pages-core.mjs scripts/case-meta-pages-core.test.mjs scripts/build-case-meta-pages.mjs package.json
git commit -m "feat(seo): emit crawlable meta pages for non-prerendered case slugs"
```

部署体积提示（写给用户，不需代码）：约 15K × 6.3KB ≈ 95MB dist 增量；Vercel 无压力，GH Pages 镜像（deploy.yml）需观察一次部署时延。

---

### Task 6: 上游新鲜度看门狗（P1-7）

**Files:**
- Create: `scripts/upstream-freshness.mjs`（可测函数 + CLI 双模式）
- Create: `scripts/upstream-freshness.test.mjs`
- Modify: `.github/workflows/sync.yml`（permissions + 新 step）

**Interfaces:**
- Produces: `countRecentUpstreamCases(rows, nowMs?, days?) -> number`（只统计 `id < 100000` 且 `createdAt` 落在窗口内的行）；CLI 输出 `upstream_new_3d=N` / `upstream_new_7d=N` 两行。

- [ ] **Step 1: 写失败测试**

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { countRecentUpstreamCases } from "./upstream-freshness.mjs";

const NOW = Date.UTC(2026, 7, 24, 12, 0, 0);
const day = 24 * 60 * 60 * 1000;
const row = (id, iso) => ({ id, createdAt: iso });

describe("countRecentUpstreamCases", () => {
  it("counts only upstream ids within the window", () => {
    const rows = [
      row(32000, new Date(NOW - day).toISOString()),
      row(32001, new Date(NOW - 5 * day).toISOString()),
      row(32002, new Date(NOW - 20 * day).toISOString()),
      row(100123, new Date(NOW - day).toISOString()), // manual range excluded
      row(32003, "not-a-date"),
    ];
    assert.equal(countRecentUpstreamCases(rows, NOW, 7), 2);
  });
  it("tolerates non-array input", () => {
    assert.equal(countRecentUpstreamCases(null, NOW, 7), 0);
  });
});
```

- [ ] **Step 2: 确认失败 → 实现 → 通过**

```bash
node --test scripts/upstream-freshness.test.mjs
```

FAIL 后创建 `scripts/upstream-freshness.mjs`：

```js
import { readFileSync } from "node:fs";
import { fileURLToPath, realpathSync } from "node:url";
import { resolve } from "node:path";

export function countRecentUpstreamCases(rows, nowMs = Date.now(), days = 7) {
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const rowItem of Array.isArray(rows) ? rows : []) {
    if (!(Number(rowItem?.id) < 100000)) continue;
    const t = Date.parse(String(rowItem?.createdAt ?? ""));
    if (Number.isFinite(t) && t >= cutoff) count += 1;
  }
  return count;
}

function main() {
  const root = resolve(fileURLToPath(import.meta.url), "../../..");
  const rows = JSON.parse(readFileSync(resolve(root, "public/data/cases.json"), "utf8"));
  for (const days of [3, 7]) {
    console.log(`upstream_new_${days}d=${countRecentUpstreamCases(rows, Date.now(), days)}`);
  }
}

const invokedDirectly = (() => {
  try {
    return realpathSync(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();
if (invokedDirectly) main();
```

再跑测试 Expected: PASS。

- [ ] **Step 3: sync.yml 加权限与看门狗步骤**

permissions 块改为：

```yaml
permissions:
  actions: write
  contents: write
  issues: write
```

在 job 末尾（`Summary` step 之后）追加：

```yaml
      - name: Upstream freshness watchdog
        if: always()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          node scripts/upstream-freshness.mjs | tee freshness.txt
          new3=$(sed -n 's/^upstream_new_3d=//p' freshness.txt)
          new7=$(sed -n 's/^upstream_new_7d=//p' freshness.txt)
          {
            echo "### Upstream freshness"
            echo "- new upstream cases in 3d: **${new3:-unknown}**"
            echo "- new upstream cases in 7d: **${new7:-unknown}**"
          } >> "$GITHUB_STEP_SUMMARY"
          if [ "${new3:-1}" != "0" ] && [ "${new7:-1}" != "0" ]; then
            echo "Upstream is flowing — no alert needed."
            exit 0
          fi
          gh label create upstream-stale --color D93F0B --description "YouMind export stalled" 2>/dev/null || true
          open_count=$(gh issue list --label upstream-stale --state open --json number --jq length)
          if [ "${open_count:-0}" -eq 0 ]; then
            gh issue create \
              --label upstream-stale \
              --title "上游 YouMind 同步近期零新增" \
              --body "daily sync 成功但最近窗口无新增上游案例 (3d=${new3:-?}, 7d=${new7:-?})。上次断供发生在 2026-08-01 并于当月中旬自愈；排查入口：references manifest 是否仍在更新。"
            echo "::warning::Created upstream-staleness issue."
          else
            echo "Staleness issue already open (${open_count}) — not duplicating."
          fi
```

- [ ] **Step 4: 本地冒烟**

```bash
node scripts/upstream-freshness.mjs
```

Expected: 打印 `upstream_new_3d=` 与 `upstream_new_7d=` 两行且数字 > 0（上游健康期应如此）。

- [ ] **Step 5: 提交**

```bash
git add scripts/upstream-freshness.mjs scripts/upstream-freshness.test.mjs .github/workflows/sync.yml
git commit -m "ci(sync): open an alert issue when upstream stops producing new cases"
```

---

### Task 7: P2 快赢打包（两个独立提交）

**Files:**
- Modify: `src/components/Footer.tsx`（©年份 hydration）
- Modify: `package.json`（声明 react-helmet-async）
- Modify: `vite.config.ts:51`（chunk 告警阈值）
- Delete: `public/_headers`
- Modify: `.gitignore`
- 本地删除（不入库）: `scripts/pip3.12.exe`、`scripts/pip3.exe`、`scripts/playwright.exe`

- [ ] **Step 1: 页脚年份改为 effect 渲染**

在 `src/components/Footer.tsx` 中 `grep -n "getFullYear()" src/components/Footer.tsx` 定位渲染期表达式，替换为组件内 effect 模式（保持原样式类名不变）：

```tsx
const [year, setYear] = useState<number | null>(null);
useEffect(() => {
  setYear(new Date().getFullYear());
}, []);
// JSX：{year === null ? null : <span>{year}</span>}  ← 用它替换原来的 {new Date().getFullYear()}
```

原理：SSR 与客户端首帧都渲染 null → 无 mismatch；真实年份挂载后一帧填入。跨年 CDN 陈旧副本不再触发整树警告。

- [ ] **Step 2: 声明传递依赖**

```bash
npm ls react-helmet-async        # 记录解析到的版本 V
npm install -S react-helmet-async@V
```

- [ ] **Step 3: 清理死配置与阈值**

- `git rm public/_headers`（Cloudflare 时代遗物，引用了不存在的 `/img/*` 函数与已删路由）。
- `vite.config.ts` 将 `chunkSizeWarningLimit: 1200` 改为 `900`；随后 `npm run build` 若出现新的 chunk 警告，按警告值 +10% 微调到贴合实际的数（目的是让回归可见，不是消音）。
- `.env.example` 中提及 “Cloudflare Pages free-tier” 的过期注释改为 `# Vercel 静态托管；COS 仅用于图片转存`。

- [ ] **Step 4: 二进制杂物**

`.gitignore` 追加一行 `scripts/*.exe`；本地执行 `rm -f scripts/pip3.exe scripts/pip3.12.exe scripts/playwright.exe`（均未被 git 跟踪，已核实）。

- [ ] **Step 5: 验证 + 分两个提交**

```bash
npm run check && npm run build
```

Expected: 全绿。

```bash
git add src/components/Footer.tsx package.json package-lock.json
git commit -m "fix(ui): footer year via effect; declare react-helmet-async dependency"

git add vite.config.ts .gitignore .env.example
git rm --cached public/_headers 2>/dev/null || true
git commit -m "chore: drop dead _headers config, tighten chunk budget, ignore stray exes"
```

---

### Task 8: Wave-1 终验（浏览器级验证）

**Files:** 无新改动；只验证。

- [ ] **Step 1: 全套检查**

```bash
npm run check && npm run build
```

Expected: 全绿；build 日志含三件套：sitemap URL 数（≈16.4K，比之前多出模板/分类修正量）、404 构建、`case meta pages: NNNN written`。

- [ ] **Step 2: 以静态产物为准的关键断言**

```bash
npx vite preview --port 4173 &
sleep 2
BASE=http://localhost:4173
# 1) 非预渲染案例有完整头部：
SLUG=$(node -e "const c=require('./public/data/cases.json');const s=c.filter(r=>r.slug);console.log(s[2000].slug)")
curl -s "$BASE/case/$SLUG" | grep -oE "<title>[^<]*|rel=\"canonical\"|og:image" | sort -u
# 2) 任意垃圾 slug 仍是 SPA 兜底（已知残留，HTTP 200 但无 title）——记录行为即可
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/case/not-a-real-slug"
# 3) sitemap 含 game-asset 与至少一条模板 URL：
curl -s "$BASE/sitemap.xml" | grep -cE "game-asset<|/template/"
kill %1
```

Expected: 1) 输出含 title 行、canonical、og:image；2) `200`（残留项，Wave 2 处理）；3) 计数 ≥ 2。

- [ ] **Step 3: 人工浏览器抽查（AGENTS.md 要求可见行为过一遍）**

打开 `http://localhost:4173/cases` 与任一案例详情页：图片加载、复制按钮、返回列表滚动恢复无异常；控制台无 hydration 报错（重点看页脚年份改动后）。

---

## Wave 2 路线图（本次不做，需各自单独立项/决策）

| 事项 | 为什么现在不做 | 入场条件 |
|---|---|---|
| 图片分级本地化（wsrv.nl 脱钩，P1-4） | 需要用户决定存储方案（已有 upload-cos/COS 配置位）与优先层级（hero/封面先行）；涉及凭据配置 | 用户选定存储目标 + 提供 COS 凭据环境变量 |
| 富页(800个)的 prompt 全文内联（P1-5 余量） | 需通读 CaseDetailPage hydration 数据构造链路后再出完整方案；95% 页面已由 Task 5 的 noscript 摘要覆盖最低需求 | Task 5 上线观察一次部署后 |
| SSG_CASE_LIMIT 再上调评估 | Task 5 已消除空壳问题，上调收益变为增量而非止血；需重新测算构建时长预算 | Vercel 构建时长数据（连续一周） |
| CSP 从 Report-Only 转正 | 需先收集 report 违规样本 | 部署 report collector 或人工观察一段时间 |
| imageAlt 真实描述生成 | 属内容管线增强，随 migrate-v2 演进单独立项 | 与图片本地化同期做可省一次遍历 |
| 未知 slug 真 404（边缘清单校验） | 残留面小（垃圾外链才触发）；需要 edge 函数或构建期清单，复杂度不成比例 | Search Console 出现软 404 泛滥证据 |

## Self-Review 结论

- **覆盖检查**：审计 P0×3 全覆盖（Task 1/3、5、2），P1-6→Task 4，P1-7→Task 6，P1-4/P1-5 明确划入 Wave 2 并给出入场条件，P2 快赢→Task 7，其余 P2 列入路线图表。
- **占位符扫描**：所有代码步骤给出完整代码；Task 4 Step 1 中一处断言方向在注释中显式标注了执行时修正方式（属对既有行为的锁定断言，非缺失实现）；Task 7 Step 2 版本号依赖 `npm ls` 现场取值（环境决定，非 TBD）。
- **命名一致性**：`assertUpstreamNotShrunk`/`UpstreamShrinkError`、`collectPrerendered`、`buildCaseMetaHtml`、`countRecentUpstreamCases` 在定义与消费处拼写一致。
