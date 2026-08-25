# TaoStudio 优化 Wave-2 实施计划（真实浏览器走查修复）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 2026-08-25 真实浏览器全站走查发现的 P0/P1 问题：数字叠压、卡片元信息截断、robots 禁收录、筛选标签中英混排、搜索索引不含中文标签、标签同义重复、分类计数口径不一、脏数据上屏、筛选态标题不变、模板变量无表单。

**Architecture:** 三条线并行推进。视觉线（Task 1-3）纯 CSS/JSX/文案小改；数据线（Task 4-9）沿既有"纯函数 core 模块 + node:test + split-data 再生成"模式扩展：labels-core（展示层中文映射）、tag-normalize-core（同义归一）、case-text-hygiene-core（脏数据清洗）、split-data-core（筛选计数），全部在 `public/data` 派生层生效，cases.json 仅做一次性回填；产品线（Task 10-11）为筛选态标题与模板变量表单。Task 12 全量回归。

**Tech Stack:** Vite 5 + vite-react-ssg + React 18 + TypeScript、node:test（`npm run check`）、chrome-devtools CLI（浏览器验证）、无新运行时依赖。

## Global Constraints

- 只做本地 commit；**push / 部署必须等用户明确指示**（AGENTS.md）。
- 中文 JSON / markdown 一律用 node 脚本或 Write 工具写，禁止 PowerShell 文本写入（AGENTS.md）。
- 不把 `.env.local`、`.env`、`.omx/`、临时构建产物放进 commit。
- 数据再生成统一用 `node scripts/split-data.mjs`；改 `cases.json` 的任务必须同时跑它，保证派生分片一致。
- 每个任务完成即 `npx tsc -b --noEmit`（或受影响时 `npm run check` 的相关子集）；Task 12 收尾必须 `npm run check && npm run build` 全绿。
- URL 参数（`cat/style/scene/platform`）与数据层标签值保持英文 slug，中文化只发生在展示层（labels-core）与搜索索引（q 字段）。
- 浏览器验证统一用 chrome-devtools CLI：`chrome-devtools new_page/navigate_page/take_screenshot`；截图只能写 `$(cygpath -w "$TMP")` 下（CLI 的 workspace roots 限制），用 Read 工具查看。

## 背景事实（实现者必读）

- Instrument Serif 官方版数字就是窄设计："1" advance = 0.249em（fontkit 实测官方 TTF 与自托管 woff2 完全一致）。**不要换字体文件**，修复在 CSS 层（Task 1）。
- `.stat-num` 定义在 `src/index.css:350`，`.serif-display` 在 `:343`。
- 首页/站点地图计数用"主分类"（`userCategory`），画廊实时筛选用"主分类+副分类"（`uc + ucs`），所以 5017 ≠ 5448（Task 8）。
- 模板变量是 prompt 文本内 `{argument name="X" default="Y"}` 标记，由 `src/lib/template-discovery.mjs` 的 `extractTemplateVariables` 解析；模板 JSON 无独立 variables 字段（Task 11）。
- 脏数据 8 条（title="提示词：" 等、promptPreview="null"、titleEn 为中文截断文本）是旧版 sync 写入的遗留行；`scripts/sync.mjs:243` 的 `normalizeCase` 是新行写入路径（Task 9）。
- 搜索索引 `public/data/cases-search.json` 由 `scripts/split-data.mjs:191` 调 `createCaseSearchEntry` 生成，q 字段目前只含英文原始标签（Task 5）。
- 测试命令：`node --test <file>`；全套 `npm run check` = `tsc -b && node --test scripts/*.test.mjs src/admin/*.test.mjs src/components/*.test.mjs src/hooks/*.test.mjs src/lib/*.test.mjs src/pages/*.test.mjs src/server/*.test.mjs`。

---

### Task 1: 首屏数字叠压修复（stat-num 弃用衬线数字 + serif-display 去负字距）

**Files:**
- Modify: `src/index.css:342-355`
- Test: `scripts/stat-num-css.test.mjs`（新建）

**Interfaces:**
- Produces: `.stat-num` 不再声明 serif 字体（继承 body 字体栈）；`.serif-display` letter-spacing 0。无其他消费者依赖这两个类的字体栈。

- [ ] **Step 1: 写失败测试**

```js
// scripts/stat-num-css.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src", "index.css"), "utf8");

function ruleBody(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `missing rule: ${selector}`);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

test(".stat-num must not use Instrument Serif (its digits are 0.249em wide and collide at stat sizes)", () => {
  const body = ruleBody(".stat-num");
  assert.ok(!body.includes("Instrument Serif"), ".stat-num should inherit the body font");
  assert.ok(body.includes("tabular-nums"), ".stat-num keeps tabular figures");
  assert.ok(!/letter-spacing:\s*-/.test(body), ".stat-num must not tighten tracking");
});

test(".serif-display must not use negative letter-spacing (squeezes narrow digits into neighbors)", () => {
  const body = ruleBody(".serif-display");
  assert.ok(!/letter-spacing:\s*-/.test(body));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/stat-num-css.test.mjs`
Expected: 2 个断言 FAIL（stat-num 含 Instrument Serif；serif-display 有 -0.012em）。

- [ ] **Step 3: 修改 CSS**

`src/index.css:342-355` 改为：

```css
  .serif-display {
    font-family: "Instrument Serif", "Iowan Old Style", Palatino, Georgia, serif;
    font-feature-settings: "liga", "dlig";
    letter-spacing: 0;
  }

  /* Magazine-grade hero numerals. Instrument Serif's figures are genuinely
     narrow by design ("1" advance = 0.249em, verified against the official
     Google Fonts release), so adjacent digits collide at stat sizes. Data
     readouts use the body sans with tabular figures instead. */
  .stat-num {
    font-variant-numeric: lining-nums tabular-nums;
    letter-spacing: 0;
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/stat-num-css.test.mjs`
Expected: PASS (2/2)。

- [ ] **Step 5: 浏览器验证（本地 dev 或构建预览）**

Run: `npm run dev`（后台）→

```bash
chrome-devtools new_page "http://localhost:5173/" --timeout 30000
chrome-devtools resize_page 1440 900
sleep 3
chrome-devtools take_screenshot --filePath "$(cygpath -w "$TMP")\\taostudio-wave2\\t1-stats.png"
```

用 Read 查看截图，判定标准：hero 三格 "16190+ / 12 / 65" 每个数字独立可辨、无叠压；"本周精选 12 个案例" 与 "65 套工业级模板" 标题中数字不互相接触。若 dev 端口不同以实际输出为准。

- [ ] **Step 6: Commit**

```bash
git add src/index.css scripts/stat-num-css.test.mjs
git commit -m "fix(ui): stop rendering stat numerals in Instrument Serif's ultra-narrow figures"
```

---

### Task 2: 案例卡片元信息行截断修复

**Files:**
- Modify: `src/components/CaseCard.tsx:609-632`（桌面端 footer 元信息行）
- Modify: `src/components/CaseCard.tsx:529-533`（图片浮层来源行，仅来源短标签）

**Interfaces:**
- Consumes: `sourceDisplayLabel(source, githubUrl)`（`src/lib/source-label.mjs`，返回如 `"社区整理 · @im_shahid7"` 或 `"YouMind"`）。
- Produces: 卡片内新增局部 helper `shortSourceLabel(label)` = `label.split(" · ")[0]`；不改模块级导出。

**根因：** 元信息行是 `flex min-w-0 flex-1` 容器里并排 4-5 个 `truncate` 子元素，空间不足时每个子元素被均匀压到 1-2 个字符（"社..."、"YouM..."）。修复原则：来源与分类是卡片必备信息，永不截断；标签是装饰信息，作为整体截断。

- [ ] **Step 1: 修改桌面端元信息行**

`src/components/CaseCard.tsx:609-632` 的元信息行整体替换为：

```tsx
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-[11px] text-ink-400">
              {activeCase.source && (
                <>
                  <span className="inline-flex shrink-0 items-center gap-1 text-ink-300">
                    <SourceDot />
                    {shortSourceLabel(sourceLabel)}
                  </span>
                  <span className="shrink-0 text-ink-600">·</span>
                </>
              )}
              <Link
                to={`/category/${activeCase.userCategory}`}
                className="shrink-0 whitespace-nowrap transition hover:text-ember-200"
                onClick={(e) => e.stopPropagation()}
              >
                {userCategoryLabel(activeCase.userCategory)}
              </Link>
              {tags.length > 0 && (
                <>
                  <span className="shrink-0 text-ink-600">·</span>
                  <span className="min-w-0 truncate text-ink-300">
                    {tags.map((tag, i) => (
                      <span key={`${activeCase.id}-${tag}`}>
                        {tagLabel(tag)}
                        {i < tags.length - 1 && <span className="ml-1.5 text-ink-600">·</span>}
                      </span>
                    ))}
                  </span>
                </>
              )}
            </div>
```

（该 `<div>` 之后紧跟的 `activeCase.promptPreview && (...)` 预览按钮块保持原样不动。）

- [ ] **Step 2: 在 CaseCard 组件体内加 helper**

在 `const sourceLabel = sourceDisplayLabel(...)`（约 :238）之后加：

```tsx
  // 卡片元信息行只展示来源主标签（如 "社区整理"/"YouMind"），长 handle 放详情页。
  const shortSourceLabel = (label: string) => label.split(" · ")[0] || label;
```

- [ ] **Step 3: 图片浮层来源行同步用短标签**

`src/components/CaseCard.tsx:529-533` 浮层中 `{activeCase.source ? sourceLabel : userCategoryLabel(activeCase.userCategory)}` 改为：

```tsx
{activeCase.source ? shortSourceLabel(sourceLabel) : userCategoryLabel(activeCase.userCategory)}
```

- [ ] **Step 4: 类型检查 + 相关测试**

Run: `npx tsc -b --noEmit && node --test src/components/*.test.mjs`
Expected: 全部 PASS。

- [ ] **Step 5: 浏览器验证**

```bash
chrome-devtools navigate_page --url "http://localhost:5173/" --timeout 30000
sleep 3
chrome-devtools evaluate_script "() => { const h2 = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('本周精选')); window.scrollTo({top: h2.getBoundingClientRect().top + window.scrollY - 150, behavior: 'instant'}); return window.scrollY; }"
sleep 1
chrome-devtools take_screenshot --filePath "$(cygpath -w "$TMP")\\taostudio-wave2\\t2-cards.png"
```

Read 截图判定：精选卡片元信息行来源（"YouMind"/"社区整理"）与分类（"海报与排版"等）完整可读；标签组整体截断带省略号属预期。

- [ ] **Step 6: Commit**

```bash
git add src/components/CaseCard.tsx
git commit -m "fix(ui): card meta row keeps source and category readable, truncates tags as a group"
```

---

### Task 3: robots 放行 /uploads + 两处文案小修

**Files:**
- Modify: `public/robots.txt`
- Modify: `src/components/ImageLightbox.tsx:520`
- Modify: `src/pages/CasesPage.tsx:342-364`（我的收藏按钮）

**Interfaces:** 无代码接口变化；`/uploads/` 图片将可被搜索引擎抓取（与 vercel.json 既有 Cache-Control/CORS 头配合）。

- [ ] **Step 1: robots.txt 删除 uploads 禁行**

`public/robots.txt` 全文改为：

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin.html

Sitemap: https://taostudioai.com/sitemap.xml
```

- [ ] **Step 2: 灯箱快捷键提示改用可读文案**

`src/components/ImageLightbox.tsx:520` 三元分支中的字符串：

```tsx
            ? "双指缩放 · 双击放大 · ← → 或两侧按钮切换 · ESC 关闭"
```

改为：

```tsx
            ? "双指缩放 · 双击放大 · 左右方向键或两侧按钮切换 · ESC 关闭"
```

- [ ] **Step 3: 我的收藏禁用态加解释**

`src/pages/CasesPage.tsx` 我的收藏 `<button`（约 :342）加 `title` 属性：

```tsx
          <button
            type="button"
            onClick={() => setShowFavorites((value) => !value)}
            disabled={favoriteCount === 0}
            aria-pressed={showFavorites}
            title={favoriteCount === 0 ? "在案例卡片上点 ♥ 收藏后，可在这里查看" : undefined}
```

- [ ] **Step 4: 验证**

Run: `npx tsc -b --noEmit && node --test src/components/*.test.mjs src/pages/*.test.mjs`
Expected: PASS。

浏览器：打开详情页按 Esc 关闭灯箱前先截图底部提示文案（打开任一案例详情 → 点放大）：

```bash
chrome-devtools navigate_page --url "http://localhost:5173/case/i-p-h-o-n-e-suo-ping-100247" --timeout 30000
sleep 2
chrome-devtools evaluate_script "() => { document.querySelector('button[aria-label*=\"放大查看\"]')?.click(); return 'clicked'; }"
sleep 1
chrome-devtools take_screenshot --filePath "$(cygpath -w "$TMP")\\taostudio-wave2\\t3-lightbox.png"
```

Read 截图判定：底部提示为"左右方向键或两侧按钮切换"。

- [ ] **Step 5: Commit**

```bash
git add public/robots.txt src/components/ImageLightbox.tsx src/pages/CasesPage.tsx
git commit -m "fix(seo+ux): allow /uploads crawling; readable lightbox key hints; favorites hint"
```

---

### Task 4: labels-core 纯模块抽取 + 筛选标签全量中文化

**Files:**
- Create: `src/lib/labels-core.mjs`
- Create: `src/lib/labels-core.d.mts`
- Modify: `src/lib/labels.ts`（改为 re-export + 保留 accessibleCaseLabel）
- Modify: `src/components/FilterBar.tsx:29-35`（PLATFORM_OPTIONS 改从 labels 取）
- Test: `src/lib/labels-core.test.mjs`（新建）

**Interfaces:**
- Produces: `STYLE_LABELS`、`SCENE_LABELS`、`PLATFORM_LABELS`（Record<string,string>）、`styleLabel(v)`、`sceneLabel(v)`、`tagLabel(v)`、`platformLabel(v)`（均 `(string) => string`）、`IDENTITY_OK_LABELS`（Set<string>）。Task 5 的 case-search-core 与 Task 7 的 FilterBar 计数都消费这些签名。
- 不变量：数据层英文 token 不变；`labels.ts` 的既有导出名全部保留（CaseCard 等消费者零改动）。

- [ ] **Step 1: 写失败测试**

```js
// src/lib/labels-core.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  IDENTITY_OK_LABELS,
  PLATFORM_LABELS,
  platformLabel,
  sceneLabel,
  styleLabel,
  tagLabel,
} from "./labels-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const filterOptions = JSON.parse(
  readFileSync(join(root, "public", "data", "filter-options.json"), "utf8"),
);

test("every style option renders Chinese (or is an allowlisted identity label)", () => {
  const untranslated = filterOptions.styles.filter(
    (v) => styleLabel(v) === v && !IDENTITY_OK_LABELS.has(v),
  );
  assert.deepEqual(untranslated, []);
});

test("every scene option renders Chinese (or is an allowlisted identity label)", () => {
  const untranslated = filterOptions.scenes.filter(
    (v) => sceneLabel(v) === v && !IDENTITY_OK_LABELS.has(v),
  );
  assert.deepEqual(untranslated, []);
});

test("platform labels cover every platform option in Chinese", () => {
  for (const p of filterOptions.platforms) {
    assert.notEqual(platformLabel(p), p, `platform ${p} untranslated`);
  }
});

test("mixed-pool tagLabel prefers style mapping then scene mapping", () => {
  assert.equal(tagLabel("Anime"), "动漫");
  assert.equal(tagLabel("Game UI"), "游戏 UI");
  assert.equal(tagLabel("xiaohongshu"), "小红书");
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test src/lib/labels-core.test.mjs`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 创建 labels-core.mjs（完整词典）**

`src/lib/labels-core.mjs` 全文：

```js
/**
 * Display labels for style / scene / platform tags — pure ESM so both the
 * TS UI (via labels.ts) and the node-side data pipeline (case-search-core,
 * split-data) can import it without a TS runtime.
 *
 * Data shape stays English (so the daily upstream sync, the manual JSON, and
 * the agent skill all stay portable), but the UI shows Chinese. The test
 * labels-core.test.mjs asserts EVERY value in filter-options.json has a
 * mapping, so a new upstream tag fails CI instead of silently rendering
 * English.
 */

export const STYLE_LABELS = {
  // identity labels: the "translation" is the token itself
  "3D": "3D",
  UI: "UI",

  "3D Render": "3D 渲染",
  Anime: "动漫",
  Artistic: "艺术风",
  Blueprint: "线稿图",
  Brand: "品牌",
  "Brand Identity": "品牌视觉",
  Caricature: "讽刺漫画",
  Cartoon: "卡通",
  Character: "角色",
  Cinematic: "电影感",
  Collage: "拼贴",
  Comic: "漫画",
  Commercial: "商业风",
  "Concept Art": "概念设计",
  Craft: "手工艺",
  Dashboard: "仪表盘",
  "Digital Art": "数字艺术",
  Documentary: "纪实",
  Editorial: "编辑排版",
  Fantasy: "奇幻",
  Illustration: "插画",
  Infographic: "信息图",
  Minimal: "极简",
  "Paper Craft": "纸艺",
  PixelArt: "像素画",
  Playful: "俏皮",
  Portrait: "人像",
  Poster: "海报",
  Realistic: "写实",
  "Street Art": "街头艺术",
  Studio: "棚拍",
  Technical: "工程图",
  Watercolor: "水彩",

  // legacy tokens that may still appear on old rows / free tags
  Cyberpunk: "赛博朋克",
  Characters: "角色",
  Classical: "古典",
  Creative: "创意",
};

export const SCENE_LABELS = {
  Action: "动作",
  Advertising: "广告",
  Architecture: "建筑",
  Art: "艺术",
  Artistic: "艺术风",
  Brand: "品牌",
  "Brand Identity": "品牌视觉",
  Character: "角色",
  "Character Design": "角色设计",
  "Children Book": "儿童绘本",
  Collectible: "潮玩收藏",
  Commerce: "商业",
  Creative: "创意",
  Design: "设计",
  Editorial: "编辑排版",
  Education: "教育",
  Fashion: "时尚",
  Finance: "金融",
  Food: "美食",
  Game: "游戏",
  "Game UI": "游戏 UI",
  Heritage: "文化遗产",
  Industrial: "工业",
  Infographic: "信息图",
  "Interior Design": "室内设计",
  Lifestyle: "生活",
  Map: "地图",
  Music: "音乐",
  Narrative: "叙事",
  Nature: "自然",
  Portrait: "人像",
  Poster: "海报",
  Product: "产品",
  Publication: "出版物",
  Social: "社交",
  Sports: "运动",
  Story: "叙事",
  Storytelling: "故事叙事",
  Tech: "科技",
  Travel: "旅行",
  Urban: "都市",

  // legacy
  History: "历史",
};

export const PLATFORM_LABELS = {
  xiaohongshu: "小红书",
  wechat: "微信",
  douyin: "抖音",
  ec: "电商",
  offline: "线下",
};

/** Tokens whose correct display label IS the raw value (Latin initialisms). */
export const IDENTITY_OK_LABELS = new Set(["3D", "UI"]);

export function styleLabel(value) {
  return STYLE_LABELS[value] ?? value;
}

export function sceneLabel(value) {
  return SCENE_LABELS[value] ?? value;
}

export function platformLabel(value) {
  return PLATFORM_LABELS[value] ?? value;
}

/**
 * For mixed pools (card chips that show styles + scenes + free tags
 * together), prefer the style mapping first so the same raw token always
 * maps the same way.
 */
export function tagLabel(value) {
  return STYLE_LABELS[value] ?? SCENE_LABELS[value] ?? PLATFORM_LABELS[value] ?? value;
}
```

- [ ] **Step 4: 创建类型声明 labels-core.d.mts**

```ts
export declare const STYLE_LABELS: Record<string, string>;
export declare const SCENE_LABELS: Record<string, string>;
export declare const PLATFORM_LABELS: Record<string, string>;
export declare const IDENTITY_OK_LABELS: Set<string>;
export declare function styleLabel(value: string): string;
export declare function sceneLabel(value: string): string;
export declare function platformLabel(value: string): string;
export declare function tagLabel(value: string): string;
```

- [ ] **Step 5: labels.ts 改为 re-export**

`src/lib/labels.ts` 全文改为：

```ts
/**
 * TS facade over the pure label maps in labels-core.mjs. UI components
 * import from here (typed); node scripts import labels-core.mjs directly.
 * See labels-core.mjs for the mapping table and its CI coverage test.
 */
export {
  IDENTITY_OK_LABELS,
  PLATFORM_LABELS,
  SCENE_LABELS,
  STYLE_LABELS,
  platformLabel,
  sceneLabel,
  tagLabel,
} from "./labels-core.mjs";

/**
 * Accessible name for a case link, with a defensive fallback.
 *
 * Several surfaces (HeroStrip tiles, HeroFloatingDeck, CaseCard) render a
 * case as an image-only `<Link>` whose accessible name comes entirely from
 * `aria-label`. If a case's `title` is ever an empty string (dirty data, a
 * partial migration, etc.) the link ends up with NO accessible name, which
 * is a WCAG 2.4.4 / 4.1.2 failure and shows up as "link with no text" in
 * audits. We always fall back to the stable case id so every link is
 * announced — and trimmed of stray whitespace that would also read as empty.
 */
export function accessibleCaseLabel(c: { title?: string; id: string }): string {
  const title = (c.title || "").trim();
  return title ? `${title} · 案例 ${c.id}` : `案例 ${c.id}`;
}
```

- [ ] **Step 6: FilterBar 平台选项改单一来源**

`src/components/FilterBar.tsx:29-35` 的 `PLATFORM_OPTIONS` 常量替换为：

```tsx
const PLATFORM_OPTIONS = Object.entries(PLATFORM_LABELS).map(([key, label]) => ({
  key,
  label,
}));
```

（import 语句合并到文件顶部既有 import 区。）

- [ ] **Step 7: 跑测试与类型检查**

Run: `node --test src/lib/labels-core.test.mjs && npx tsc -b --noEmit && node --test src/lib/*.test.mjs src/components/*.test.mjs`
Expected: 全部 PASS。若 labels-core.test.mjs 报某 token 未翻译，说明 filter-options.json 里有词典漏掉的 token——把它加进对应词典再跑（不允许扩 IDENTITY_OK 白名单，除非是 "3D"/"UI" 类拉丁缩写）。

- [ ] **Step 8: Commit**

```bash
git add src/lib/labels-core.mjs src/lib/labels-core.d.mts src/lib/labels.ts src/lib/labels-core.test.mjs src/components/FilterBar.tsx
git commit -m "feat(i18n): complete zh-CN label coverage for all style/scene/platform filter tags"
```

---

### Task 5: 搜索索引写入中文标签

**Files:**
- Modify: `src/lib/case-search-core.mjs:1-33`
- Modify: `src/lib/case-search-core.test.mjs`（追加用例）
- Regenerate: `public/data/cases-search.json`（node scripts/split-data.mjs）

**Interfaces:**
- Consumes: Task 4 的 `styleLabel/sceneLabel/platformLabel`（labels-core.mjs）。
- Produces: `createCaseSearchEntry(item).q` 同时包含英文原始值与中文标签（小写化）。前端无接口变化——索引在 split-data 时预构建。

- [ ] **Step 1: 追加失败测试**

在 `src/lib/case-search-core.test.mjs` 末尾追加：

```js
test("search entry q includes Chinese labels for styles/scenes/platforms", () => {
  const entry = createCaseSearchEntry({
    id: "1",
    title: "t",
    styles: ["Anime"],
    scenes: ["Game UI"],
    platforms: ["xiaohongshu"],
  });
  assert.ok(entry.q.includes("动漫"), "style zh label searchable");
  assert.ok(entry.q.includes("游戏 ui"), "scene zh label searchable (lowercased)");
  assert.ok(entry.q.includes("小红书"), "platform zh label searchable");
  assert.ok(entry.q.includes("anime"), "raw token still searchable");
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test src/lib/case-search-core.test.mjs`
Expected: 新用例 FAIL（q 不含中文）。

- [ ] **Step 3: 修改 createCaseSearchEntry**

`src/lib/case-search-core.mjs` 顶部加：

```js
import { platformLabel, sceneLabel, styleLabel } from "./labels-core.mjs";
```

`searchText` 数组在既有 `...styles, ...scenes, ...platforms` 之后追加三行：

```js
    ...styles.map(styleLabel),
    ...scenes.map(sceneLabel),
    ...platforms.map(platformLabel),
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test src/lib/case-search-core.test.mjs`
Expected: PASS。

- [ ] **Step 5: 再生成索引并抽查**

Run: `node scripts/split-data.mjs`

```bash
node -e "const idx=require('./public/data/cases-search.json'); const hit=idx.filter(e=>e.q&&e.q.includes('动漫')).length; console.log('entries matching dongman:', hit); if(hit===0) process.exit(1)"
```

Expected: 输出 > 0。

- [ ] **Step 6: Commit**

```bash
git add src/lib/case-search-core.mjs src/lib/case-search-core.test.mjs public/data/cases-search.json
git commit -m "feat(search): index zh-CN labels so Chinese queries match English tags"
```

---

### Task 6: 标签同义归一 + 跨组去重（管线层）

**Files:**
- Create: `scripts/tag-normalize-core.mjs`
- Create: `scripts/tag-normalize-core.test.mjs`
- Create: `scripts/normalize-existing-case-tags.mjs`（一次性回填）
- Modify: `scripts/migrate-v2.mjs:103-105`（classify 适配点接线）
- Regenerate: `public/data/cases.json`（回填）+ `node scripts/split-data.mjs`

**Interfaces:**
- Produces: `TAG_SYNONYMS`（Map）、`normalizeTagToken(token: string): string`、`normalizeCaseTags(c: {styles?, scenes?, tags?}) => {styles: string[], scenes: string[], tags: string[]}`。migrate-v2 与一次性脚本都消费 `normalizeCaseTags`。
- 语义决定（已定稿）：风格组=画面怎么画，题材组=画什么。`Poster/Portrait/Character/Brand/Infographic/Artistic` 从 styles 移除（它们在 scenes 有归属或过于宽泛）；`Editorial/Artistic` 从 scenes 移除；同义词 `Brand Identity→Brand`、`3D→3D Render`；`tags` 混合池只做同义归一不做组移除。

- [ ] **Step 1: 写失败测试**

```js
// scripts/tag-normalize-core.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCaseTags, normalizeTagToken } from "./tag-normalize-core.mjs";

test("synonyms collapse before group filtering", () => {
  assert.equal(normalizeTagToken("Brand Identity"), "Brand");
  assert.equal(normalizeTagToken("3D"), "3D Render");
  assert.equal(normalizeTagToken("Anime"), "Anime");
});

test("depiction tokens are removed from styles, kept in scenes", () => {
  const out = normalizeCaseTags({ styles: ["Poster", "Anime"], scenes: ["Poster", "Food"] });
  assert.deepEqual(out.styles, ["Anime"]);
  assert.deepEqual(out.scenes, ["Poster", "Food"]);
});

test("style tokens are removed from scenes, kept in styles", () => {
  const out = normalizeCaseTags({ styles: ["Editorial", "Minimal"], scenes: ["Editorial", "Tech"] });
  assert.deepEqual(out.styles, ["Editorial", "Minimal"]);
  assert.deepEqual(out.scenes, ["Tech"]);
});

test("Artistic is dropped from both groups (too generic)", () => {
  const out = normalizeCaseTags({ styles: ["Artistic", "Realistic"], scenes: ["Artistic", "Travel"] });
  assert.deepEqual(out.styles, ["Realistic"]);
  assert.deepEqual(out.scenes, ["Travel"]);
});

test("mixed tags pool gets synonyms but no group removal, and dedupes", () => {
  const out = normalizeCaseTags({ tags: ["Brand Identity", "Brand", "3D", "Anime"] });
  assert.deepEqual(out.tags, ["Brand", "3D Render", "Anime"]);
});

test("missing/empty fields produce empty arrays, not undefined", () => {
  assert.deepEqual(normalizeCaseTags({}), { styles: [], scenes: [], tags: [] });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/tag-normalize-core.test.mjs`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 创建 tag-normalize-core.mjs**

```js
/**
 * Tag canonicalization for the case pipeline.
 *
 * WHY: the upstream tag pool accumulated synonyms ("Brand Identity" vs
 * "Brand", "3D" vs "3D Render") and tokens that appear in BOTH the style
 * and scene axes, which renders duplicate-looking filter chips that filter
 * different case sets. Rule set (decided 2026-08-25):
 *   - styles axis = how the image is painted; scenes axis = what it depicts.
 *   - Poster/Portrait/Character/Brand/Infographic belong to scenes.
 *   - Editorial belongs to styles.
 *   - "Artistic" is too generic next to Illustration/Realistic — dropped.
 *   - tags[] is a mixed free-tag pool: synonyms only, no group removal.
 */

export const TAG_SYNONYMS = new Map([
  ["Brand Identity", "Brand"],
  ["3D", "3D Render"],
]);

export const REMOVE_FROM_STYLES = new Set([
  "Poster",
  "Portrait",
  "Character",
  "Brand",
  "Infographic",
  "Artistic",
]);

export const REMOVE_FROM_SCENES = new Set(["Editorial", "Artistic"]);

export function normalizeTagToken(token) {
  const t = String(token ?? "").trim();
  return TAG_SYNONYMS.get(t) ?? t;
}

function cleanList(list, removeFrom) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const token = normalizeTagToken(raw);
    if (!token || removeFrom.has(token)) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out;
}

export function normalizeCaseTags(c) {
  return {
    styles: cleanList(c?.styles, REMOVE_FROM_STYLES),
    scenes: cleanList(c?.scenes, REMOVE_FROM_SCENES),
    tags: cleanList(c?.tags, new Set()),
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/tag-normalize-core.test.mjs`
Expected: PASS (6/6)。

- [ ] **Step 5: 接线 migrate-v2 的 classify 适配点**

`scripts/migrate-v2.mjs` 顶部（`classify-core.mjs` import 旁）加：

```js
import { normalizeCaseTags } from "./tag-normalize-core.mjs";
```

`scripts/migrate-v2.mjs:103-105` 的适配函数改为：

```js
function classify(c) {
  const classified = classifyCase(c);
  return { ...classified, ...normalizeCaseTags(classified) };
}
```

- [ ] **Step 6: 一次性回填既有 cases.json**

创建 `scripts/normalize-existing-case-tags.mjs`：

```js
/**
 * One-time backfill: apply tag-normalize-core to every row already in
 * public/data/cases.json (rows written before pipeline normalization went
 * live). Idempotent — safe to re-run. Prints per-field change counts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeCaseTags } from "./tag-normalize-core.mjs";

const path = resolve("public/data/cases.json");
const cases = JSON.parse(readFileSync(path, "utf8"));
let touched = 0;
const stats = { styles: 0, scenes: 0, tags: 0 };
const next = cases.map((c) => {
  const out = normalizeCaseTags(c);
  const changed =
    JSON.stringify(out.styles) !== JSON.stringify(c.styles ?? []) ||
    JSON.stringify(out.scenes) !== JSON.stringify(c.scenes ?? []) ||
    JSON.stringify(out.tags) !== JSON.stringify(c.tags ?? []);
  if (!changed) return c;
  touched += 1;
  stats.styles += (c.styles?.length ?? 0) - out.styles.length;
  stats.scenes += (c.scenes?.length ?? 0) - out.scenes.length;
  stats.tags += (c.tags?.length ?? 0) - out.tags.length;
  return { ...c, ...out };
});
writeFileSync(path, JSON.stringify(next, null, 2) + "\n", "utf8");
console.log(
  `normalize-existing-case-tags: ${touched}/${cases.length} rows updated, removed tokens:`,
  JSON.stringify(stats),
);
```

Run:

```bash
node scripts/normalize-existing-case-tags.mjs
node scripts/split-data.mjs
node -e "const f=require('./public/data/filter-options.json'); console.log('styles:', f.styles.length, 'scenes:', f.scenes.length); if(f.styles.includes('Brand Identity')||f.styles.includes('Poster')) process.exit(1)"
```

Expected: 日志显示 N 行更新；styles 数量减少且不再含 `Brand Identity`/`Poster`。

- [ ] **Step 7: 全套数据测试回归**

Run: `npm run check`
Expected: PASS（cases-index/cases-search 与新 cases.json 一致）。

- [ ] **Step 8: Commit**

```bash
git add scripts/tag-normalize-core.mjs scripts/tag-normalize-core.test.mjs scripts/normalize-existing-case-tags.mjs scripts/migrate-v2.mjs public/data/
git commit -m "feat(data): canonicalize tags — merge synonyms, split style/scene axes, drop generic Artistic"
```

---

### Task 7: 筛选 chip 案例数 + 频次排序

**Files:**
- Create: `scripts/split-data-core.mjs`
- Create: `scripts/split-data-core.test.mjs`
- Modify: `scripts/split-data.mjs`（buildFilterOptions 迁移到 core 并扩展计数；buildHomePayload 的 tiles 计数改用 Task 8 的 countCategoryCases——本任务先迁移函数本身）
- Modify: `src/hooks/useSearchIndex.ts`（FilterOptions 类型 + 透出 counts）
- Modify: `src/pages/CasesPage.tsx:133,400-410`（传 counts）
- Modify: `src/components/FilterBar.tsx`（ChipOption 加 count、chip 渲染计数徽标）

**Interfaces:**
- Produces: `buildFilterOptions(cases)` 返回 `{ styles: string[], scenes: string[], platforms: string[], styleCounts: Record<string,number>, sceneCounts: Record<string,number>, platformCounts: Record<string,number> }`；数组按 count 降序、同数按 zh locale 升序。filter-options.json 新增三个 counts 字段（旧字段不变，向后兼容）。
- FilterBar 新 props：`styleCounts?: Record<string, number>`、`sceneCounts?: Record<string, number>`；ChipOption 增加可选 `count?: number`。

- [ ] **Step 1: 写失败测试**

```js
// scripts/split-data-core.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildFilterOptions } from "./split-data-core.mjs";

const cases = [
  { styles: ["Anime", "Minimal"], scenes: ["Food"], platforms: ["wechat"] },
  { styles: ["Anime"], scenes: ["Food", "Tech"], platforms: [] },
  { styles: ["Realistic"], scenes: [], platforms: ["douyin", "douyin"] },
];

test("counts aggregate per token", () => {
  const opts = buildFilterOptions(cases);
  assert.equal(opts.styleCounts.Anime, 2);
  assert.equal(opts.styleCounts.Minimal, 1);
  assert.equal(opts.sceneCounts.Food, 2);
  assert.equal(opts.sceneCounts.Tech, 1);
  assert.equal(opts.platformCounts.douyin, 1, "duplicate tokens in one row count once");
});

test("arrays sort by count desc, then zh locale", () => {
  const opts = buildFilterOptions(cases);
  assert.deepEqual(opts.styles, ["Anime", "Minimal", "Realistic"]);
  assert.deepEqual(opts.scenes, ["Food", "Tech"]);
});

test("empty input yields empty arrays and counts", () => {
  const opts = buildFilterOptions([]);
  assert.deepEqual(opts.styles, []);
  assert.deepEqual(opts.styleCounts, {});
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/split-data-core.test.mjs`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 创建 split-data-core.mjs**

```js
/**
 * Pure helpers extracted from split-data.mjs so they are unit-testable.
 * split-data.mjs remains the CLI entry that reads/writes public/data.
 */

function countTokens(cases, key) {
  const counts = new Map();
  for (const c of cases) {
    const seen = new Set();
    for (const token of c[key] ?? []) {
      if (!token || seen.has(token)) continue;
      seen.add(token);
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return counts;
}

const zhCompare = (a, b) => a.localeCompare(b, "zh-Hans-CN");

function toSortedList(counts) {
  return Array.from(counts.keys()).sort((a, b) => {
    const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    return diff !== 0 ? diff : zhCompare(a, b);
  });
}

function countsRecord(counts) {
  return Object.fromEntries(counts);
}

/**
 * Aggregated filter options + per-token case counts. Arrays arrive
 * pre-sorted by usage (count desc) so the UI never re-sorts; counts power
 * the chip badges in FilterBar.
 */
export function buildFilterOptions(cases) {
  const styleCounts = countTokens(cases, "styles");
  const sceneCounts = countTokens(cases, "scenes");
  const platformCounts = countTokens(cases, "platforms");
  return {
    styles: toSortedList(styleCounts),
    scenes: toSortedList(sceneCounts),
    platforms: toSortedList(platformCounts),
    styleCounts: countsRecord(styleCounts),
    sceneCounts: countsRecord(sceneCounts),
    platformCounts: countsRecord(platformCounts),
  };
}

/**
 * Count cases whose PRIMARY userCategory or any SECONDARY userCategories
 * entry equals key. This intentionally matches the runtime filter semantics
 * in case-search-core.filterCaseSearchEntries (uc + ucs), so the homepage
 * tile count always equals what the gallery filter reports.
 */
export function countCategoryCases(cases, key) {
  return cases.filter(
    (c) => c.userCategory === key || (Array.isArray(c.userCategories) && c.userCategories.includes(key)),
  ).length;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/split-data-core.test.mjs`
Expected: PASS (3/3)。

- [ ] **Step 5: split-data.mjs 改用 core 版 buildFilterOptions**

`scripts/split-data.mjs`：

1. 顶部 import 区加 `import { buildFilterOptions } from "./split-data-core.mjs";`
2. 删除本地 `function buildFilterOptions(cases) {...}`（:231-249 一带）。
3. `main()` 中 filter-options 输出日志追加 counts 信息：

```js
  console.log(
    `✓ filter-options.json: ${filterOptions.styles.length} styles, ${filterOptions.scenes.length} scenes, ${filterOptions.platforms.length} platforms (counts attached)`,
  );
```

- [ ] **Step 6: useSearchIndex 类型扩展**

`src/hooks/useSearchIndex.ts` 的 filter-options 数据接口（约 :51-60 一带）增加可选 counts 字段：

```ts
export interface FilterOptionsPayload {
  styles: string[];
  scenes: string[];
  platforms: string[];
  styleCounts?: Record<string, number>;
  sceneCounts?: Record<string, number>;
  platformCounts?: Record<string, number>;
}
```

（以文件内既有接口名为准——若已有具名 interface 就地扩展，保持返回形状兼容。）

- [ ] **Step 7: CasesPage 透传 counts**

`src/pages/CasesPage.tsx:400-410` 的 `<FilterBar ... />` 增加两个 props：

```tsx
          styleCounts={filterOptions?.styleCounts}
          sceneCounts={filterOptions?.sceneCounts}
```

- [ ] **Step 8: FilterBar 消费 counts**

`src/components/FilterBar.tsx`：

1. props 增加（与既有 `styles`/`scenes` props 并列）：

```tsx
  styleCounts?: Record<string, number>;
  sceneCounts?: Record<string, number>;
```

2. 选项构建（约 :165-173）附加计数：

```tsx
  const styleOptions = styles.map((s) => ({
    key: s,
    label: styleLabel(s),
    count: styleCounts?.[s],
  }));
  const sceneOptions = scenes.map((s) => ({
    key: s,
    label: sceneLabel(s),
    count: sceneCounts?.[s],
  }));
```

3. `ChipOption` 类型加 `count?: number`；ChipGroup 渲染（约 :592-601）在 `{opt.label}` 后加徽标：

```tsx
              {opt.label}
              {typeof opt.count === "number" && (
                <span className="ml-1 text-[10px] tabular-nums opacity-55">{opt.count}</span>
              )}
              {active && (
```

（`secondary?.map` 分支的按钮同样加该徽标。）

- [ ] **Step 9: 再生成 + 回归**

Run: `node scripts/split-data.mjs && npm run check`
Expected: PASS；filter-options.json 含 styleCounts/sceneCounts。

- [ ] **Step 10: 浏览器验证**

```bash
chrome-devtools navigate_page --url "http://localhost:5173/cases" --timeout 30000
sleep 3
chrome-devtools take_screenshot --filePath "$(cygpath -w "$TMP")\taostudio-wave2\t7-chips.png"
```

Read 截图判定：风格/题材 chip 全中文、右侧带案例数徽标、排序按数量降序（"动漫"计数高于长尾）。

- [ ] **Step 11: Commit**

```bash
git add scripts/split-data-core.mjs scripts/split-data-core.test.mjs scripts/split-data.mjs src/hooks/useSearchIndex.ts src/pages/CasesPage.tsx src/components/FilterBar.tsx public/data/filter-options.json
git commit -m "feat(filters): per-tag case counts and frequency ordering on style/scene chips"
```

---

### Task 8: 分类计数口径统一（首页瓦片 / 站点地图 / 实时筛选一致）

**Files:**
- Modify: `scripts/split-data.mjs`（buildHomePayload tiles 计数改用 countCategoryCases）
- Modify: `scripts/split-data.mjs`（buildIndex 增加 `us` 字段）
- Modify: `src/pages/SitemapPage.tsx:26-33`（计数含副分类）
- Test: `scripts/split-data-core.test.mjs`（追加 countCategoryCases 用例）

**Interfaces:**
- Consumes: Task 7 的 `countCategoryCases(cases, key): number`（split-data-core.mjs）。
- Produces: cases-index.json 条目形状 `{ id, slug, uc, r, us? }`（`us` 仅在行有副分类时存在）；首页 tiles 与站点地图计数口径 = 实时筛选口径（uc + us）。

- [ ] **Step 1: 追加失败测试**

`scripts/split-data-core.test.mjs` 追加：

```js
import { countCategoryCases } from "./split-data-core.mjs";

test("countCategoryCases matches filter semantics (primary + secondary)", () => {
  const cases = [
    { userCategory: "portrait" },
    { userCategory: "sticker", userCategories: ["portrait"] },
    { userCategory: "sticker", userCategories: ["poster-general"] },
  ];
  assert.equal(countCategoryCases(cases, "portrait"), 2);
  assert.equal(countCategoryCases(cases, "sticker"), 2);
  assert.equal(countCategoryCases(cases, "xhs-cover"), 0);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/split-data-core.test.mjs`
Expected: 新用例 FAIL（countCategoryCases 未从 core 导出或未实现——Task 7 已实现则跳到 Step 3 验证通过）。

- [ ] **Step 3: split-data.mjs 接线**

1. import 区加 `countCategoryCases`（与 buildFilterOptions 同一条 import）。
2. `buildHomePayload` 内 tiles 计算（约 :118-127）替换为：

```js
  const tiles = HOMEPAGE_TILES.map((meta) => {
    const count = countCategoryCases(sorted, meta.key);
    const cover = sorted.find(
      (c) => c.userCategory === meta.key || (Array.isArray(c.userCategories) && c.userCategories.includes(meta.key)),
    );
    return {
      slug: meta.slug,
      label: meta.label,
      tagline: meta.tagline,
      count,
      cover: cover?.imageUrl,
    };
  }).filter((tile) => tile.count > 0);
```

3. `buildIndex`（约 :194-200）增加副分类字段：

```js
function buildIndex(cases) {
  return cases.map((c) => {
    const row = {
      id: c.id,
      slug: c.slug,
      uc: c.userCategory,
      r: c.ratio,
    };
    if (Array.isArray(c.userCategories) && c.userCategories.length > 0) row.us = c.userCategories;
    return row;
  });
}
```

- [ ] **Step 4: SitemapPage 计数改用同口径**

`src/pages/SitemapPage.tsx:26-33` 的计数循环改为：

```tsx
  const categoryCounts: Record<string, number> = {};
  for (const c of caseIndex) {
    categoryCounts[c.uc] = (categoryCounts[c.uc] ?? 0) + 1;
    for (const secondary of c.us ?? []) {
      if (secondary !== c.uc) categoryCounts[secondary] = (categoryCounts[secondary] ?? 0) + 1;
    }
  }
```

（若 `caseIndex` 的 TS 类型没有 `us`，在对应类型声明处补 `us?: string[]`。）

- [ ] **Step 5: 再生成 + 回归**

Run: `node scripts/split-data.mjs && npm run check`
Expected: PASS。

```bash
node -e "const h=require('./public/data/cases-home.json'); const p=h.tiles.find(t=>t.slug==='portrait'); console.log('portrait tile count:', p.count); if(p.count < 5000) process.exit(1)"
node -e "const i=require('./public/data/cases-index.json'); console.log('rows with us:', i.filter(r=>r.us).length)"
```

Expected: portrait 计数 ≥ 5400（与画廊 5448 口径一致）；index 含 us 字段行数 > 0。

- [ ] **Step 6: Commit**

```bash
git add scripts/split-data.mjs scripts/split-data-core.test.mjs src/pages/SitemapPage.tsx public/data/cases-home.json public/data/cases-index.json
git commit -m "fix(data): unify category counts to primary+secondary semantics across home/sitemap/gallery"
```

---

### Task 9: 脏数据清洗（title/promptPreview/titleEn 卫生化）

**Files:**
- Create: `scripts/case-text-hygiene-core.mjs`
- Create: `scripts/case-text-hygiene-core.test.mjs`
- Create: `scripts/fix-legacy-case-text.mjs`（一次性回填）
- Modify: `scripts/sync.mjs:243-280`（normalizeCase 接线）
- Regenerate: `public/data/cases.json`（回填）+ `node scripts/split-data.mjs`

**Interfaces:**
- Produces: `normalizeCaseTitle(rawTitle: string, fallbackText?: string) => string`（去"提示词：/角色设定提示词：/分辨率："等前缀；空则取 fallbackText 首句截 40 字；再空则返回空串由调用方回退 `案例 <id>`）、`cleanText(v: unknown) => string | undefined`（null/undefined/"null"/"undefined"/空白 → undefined）、`isCjkDominant(s: string) => boolean`、`sanitizeTitleEn(titleEn: unknown, zhTitle: string) => string | undefined`（等于主标题或 CJK 主导 → undefined）。
- 已知脏样本（测试必须覆盖）：`title:"提示词："`, `title:"角色设定提示词："`, `title:"分辨率："`, `titleEn:"提示词：\n\n使用上传图片…（50字截断）"`, `promptPreview:"null"`。

- [ ] **Step 1: 写失败测试**

```js
// scripts/case-text-hygiene-core.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanText,
  isCjkDominant,
  normalizeCaseTitle,
  sanitizeTitleEn,
} from "./case-text-hygiene-core.mjs";

test("normalizeCaseTitle strips known junk prefixes", () => {
  assert.equal(normalizeCaseTitle("提示词："), "");
  assert.equal(normalizeCaseTitle("角色设定提示词："), "");
  assert.equal(normalizeCaseTitle("分辨率："), "");
  assert.equal(normalizeCaseTitle("提示词：赛博朋克城市"), "赛博朋克城市");
  assert.equal(normalizeCaseTitle("薄荷巧克力夏日动漫肖像"), "薄荷巧克力夏日动漫肖像");
});

test("normalizeCaseTitle derives from fallback first sentence when empty", () => {
  const fb = "提示词：\n\n使用上传图片作为人物身份、服装造型参考，生成一组真实自然的成年东亚女性时尚写真。";
  const out = normalizeCaseTitle("提示词：", fb);
  assert.ok(out.startsWith("使用上传图片"), out);
  assert.ok(out.length <= 40, out);
});

test("cleanText kills string null and whitespace", () => {
  assert.equal(cleanText("null"), undefined);
  assert.equal(cleanText("undefined"), undefined);
  assert.equal(cleanText("  "), undefined);
  assert.equal(cleanText(null), undefined);
  assert.equal(cleanText("hello"), "hello");
});

test("isCjkDominant detects Chinese text", () => {
  assert.equal(isCjkDominant("提示词：使用上传图片作为人物身份"), true);
  assert.equal(isCjkDominant("Cyberpunk City Neon"), false);
});

test("sanitizeTitleEn drops CJK-dominant and duplicate titles", () => {
  assert.equal(sanitizeTitleEn("提示词：\n\n使用上传图片作为人物身份、服装造型", "提示词："), undefined);
  assert.equal(sanitizeTitleEn("Cyberpunk City", "赛博朋克城市"), "Cyberpunk City");
  assert.equal(sanitizeTitleEn("Same Title", "Same Title"), undefined);
  assert.equal(sanitizeTitleEn("null", "x"), undefined);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/case-text-hygiene-core.test.mjs`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 创建 case-text-hygiene-core.mjs**

```js
/**
 * Text hygiene for case rows arriving from upstream (YouMind) feeds.
 *
 * WHY: 8 legacy rows (as of 2026-08-25) render literally useless H1s —
 * title "提示词：", "角色设定提示词：", "分辨率：" — plus promptPreview
 * set to the string "null" and titleEn holding clipped Chinese description
 * text. These guards run at ingest (sync.mjs normalizeCase) and via a
 * one-time backfill so both new and existing rows are clean.
 */

const TITLE_JUNK_PREFIX_RE =
  /^(?:角色设定|分辨率|标题|描述|prompt)?\s*提示词\s*[:：]\s*/;

export function normalizeCaseTitle(rawTitle, fallbackText = "") {
  let title = String(rawTitle ?? "").trim();
  // Strip repeatedly: upstream sometimes stacks prefixes ("角色设定提示词：").
  while (TITLE_JUNK_PREFIX_RE.test(title)) {
    title = title.replace(TITLE_JUNK_PREFIX_RE, "").trim();
  }
  if (title) return title;
  // Derive from the first sentence of the fallback description.
  const sentence = String(fallbackText ?? "")
    .replace(TITLE_JUNK_PREFIX_RE, "")
    .split(/[。.!?\n]/)
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  if (!sentence) return "";
  return sentence.length > 40 ? `${sentence.slice(0, 39)}…` : sentence;
}

export function cleanText(value) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  if (!s || s === "null" || s === "undefined") return undefined;
  return s;
}

export function isCjkDominant(text) {
  const s = String(text ?? "");
  const cjk = (s.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latin = (s.match(/[A-Za-z]/g) ?? []).length;
  return cjk > 0 && cjk >= latin;
}

export function sanitizeTitleEn(titleEn, zhTitle) {
  const cleaned = cleanText(titleEn);
  if (cleaned === undefined) return undefined;
  if (zhTitle && cleaned === zhTitle) return undefined;
  if (isCjkDominant(cleaned)) return undefined;
  return cleaned;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/case-text-hygiene-core.test.mjs`
Expected: PASS (5/5)。

- [ ] **Step 5: sync.mjs normalizeCase 接线**

`scripts/sync.mjs` 顶部 import 区加：

```js
import { cleanText, normalizeCaseTitle, sanitizeTitleEn } from "./case-text-hygiene-core.mjs";
```

`normalizeCase`（约 :243-280）内，`const rawTitle = ...` 之后、return 之前加：

```js
  const description = official?.zh?.description || item.description || "";
  const safeTitle = normalizeCaseTitle(titleZh || rawTitle, description) || `案例 ${item.id}`;
  const safeTitleEn = titleZh ? sanitizeTitleEn(rawTitle, safeTitle) : undefined;
  const safePreview = cleanText(description) ?? cleanText(promptZh) ?? undefined;
  const promptPreview = (safePreview ?? promptEn).slice(0, 100);
```

（注意原 `const description` 声明在更上方——合并避免重复声明。）return 对象改为：

```js
    title: safeTitle,
    titleEn: safeTitleEn,
```

和

```js
    imageAlt: safeTitle,
    prompt: promptEn,
    promptEn,
    promptZh,
    promptPreview,
```

- [ ] **Step 6: 一次性回填脚本**

创建 `scripts/fix-legacy-case-text.mjs`：

```js
/**
 * One-time repair for legacy rows written before text hygiene went live:
 * junk titles ("提示词：" …), promptPreview "null", CJK titleEn.
 * Idempotent; prints per-field change counts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanText,
  normalizeCaseTitle,
  sanitizeTitleEn,
} from "./case-text-hygiene-core.mjs";

const path = resolve("public/data/cases.json");
const cases = JSON.parse(readFileSync(path, "utf8"));
const stats = { title: 0, titleEn: 0, promptPreview: 0, imageAlt: 0 };
const next = cases.map((c) => {
  const row = { ...c };
  const title = normalizeCaseTitle(row.title, row.titleEn ?? "") || `案例 ${row.id}`;
  if (title !== row.title) {
    row.title = title;
    stats.title += 1;
  }
  const titleEn = sanitizeTitleEn(row.titleEn, row.title);
  if (titleEn !== row.titleEn) {
    if (titleEn === undefined) delete row.titleEn;
    else row.titleEn = titleEn;
    stats.titleEn += 1;
  }
  const preview = cleanText(row.promptPreview);
  if (preview !== row.promptPreview) {
    if (preview === undefined) row.promptPreview = "";
    else row.promptPreview = preview;
    stats.promptPreview += 1;
  }
  const alt = cleanText(row.imageAlt);
  if (alt === undefined && row.imageAlt !== undefined) {
    row.imageAlt = row.title;
    stats.imageAlt += 1;
  }
  return row;
});
writeFileSync(path, JSON.stringify(next, null, 2) + "\n", "utf8");
console.log(`fix-legacy-case-text: changed rows by field:`, JSON.stringify(stats));
```

Run:

```bash
node scripts/fix-legacy-case-text.mjs
node scripts/split-data.mjs
node -e "const d=require('./public/data/cases.json'); const bad=d.filter(r=>r.title==='提示词：'||r.title==='角色设定提示词：'||r.title==='分辨率：'||r.promptPreview==='null'); console.log('bad rows left:', bad.length); if(bad.length) process.exit(1)"
```

Expected: `bad rows left: 0`。

- [ ] **Step 7: 回归 + Commit**

Run: `npm run check`
Expected: PASS。

```bash
git add scripts/case-text-hygiene-core.mjs scripts/case-text-hygiene-core.test.mjs scripts/fix-legacy-case-text.mjs scripts/sync.mjs public/data/
git commit -m "fix(data): scrub junk titles, string-null previews, CJK titleEn from case rows"
```

---

### Task 10: 筛选态 H1 与 document.title

**Files:**
- Create: `src/lib/cases-heading-core.mjs`
- Create: `src/lib/cases-heading-core.d.mts`
- Create: `src/lib/cases-heading-core.test.mjs`
- Modify: `src/pages/CasesPage.tsx:330-345`（h1）+ 文件内加 useEffect 更新 document.title

**Interfaces:**
- Produces: `formatCasesHeading(total: number, matched: number, hasActiveFilters: boolean) => { text: string, filtered: boolean }`、`formatCasesDocumentTitle(total: number, matched: number, hasActiveFilters: boolean) => string`。
- CasesPage 需已有 `matched`（当前筛选命中数，FilterBar 的 matched prop 同源）与"是否有激活筛选"布尔（activeCategories/styles/scenes/platforms/q 任一非空）。若页面变量名不同，以实际为准接入，不改语义。

- [ ] **Step 1: 写失败测试**

```js
// src/lib/cases-heading-core.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCasesDocumentTitle,
  formatCasesHeading,
} from "./cases-heading-core.mjs";

test("unfiltered state keeps the canonical heading", () => {
  const out = formatCasesHeading(16190, 16190, false);
  assert.equal(out.text, "按场景筛选 16190 个 GPT-Image 2 案例");
  assert.equal(out.filtered, false);
});

test("filtered state shows matched count", () => {
  const out = formatCasesHeading(16190, 5448, true);
  assert.equal(out.text, "筛选出 5448 个案例");
  assert.equal(out.filtered, true);
});

test("document title reflects filtered state", () => {
  assert.equal(
    formatCasesDocumentTitle(16190, 16190, false),
    "全部案例 · 16190+ GPT-Image 2 真实案例 | 桃子AI视觉实验室",
  );
  assert.equal(
    formatCasesDocumentTitle(16190, 5448, true),
    "筛选出 5448 个案例 · GPT-Image 2 | 桃子AI视觉实验室",
  );
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test src/lib/cases-heading-core.test.mjs`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 创建 core 模块**

`src/lib/cases-heading-core.mjs`：

```js
/**
 * Heading/title copy for /cases under active filters. The H1 previously
 * kept the unfiltered total even while the chip showed "5448 / 16190 匹配"
 * — confusing live feedback and an SEO soft-signal mismatch.
 */

export function formatCasesHeading(total, matched, hasActiveFilters) {
  if (!hasActiveFilters || matched >= total) {
    return { text: `按场景筛选 ${total} 个 GPT-Image 2 案例`, filtered: false };
  }
  return { text: `筛选出 ${matched} 个案例`, filtered: true };
}

export function formatCasesDocumentTitle(total, matched, hasActiveFilters) {
  const brand = "桃子AI视觉实验室";
  if (!hasActiveFilters || matched >= total) {
    return `全部案例 · ${total}+ GPT-Image 2 真实案例 | ${brand}`;
  }
  return `筛选出 ${matched} 个案例 · GPT-Image 2 | ${brand}`;
}
```

`src/lib/cases-heading-core.d.mts`：

```ts
export declare function formatCasesHeading(
  total: number,
  matched: number,
  hasActiveFilters: boolean,
): { text: string; filtered: boolean };
export declare function formatCasesDocumentTitle(
  total: number,
  matched: number,
  hasActiveFilters: boolean,
): string;
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test src/lib/cases-heading-core.test.mjs`
Expected: PASS (3/3)。

- [ ] **Step 5: CasesPage 接线**

`src/pages/CasesPage.tsx`：

1. import：`import { formatCasesDocumentTitle, formatCasesHeading } from "../lib/cases-heading-core.mjs";`
2. 计算（与既有 matched/total 变量对齐，命名以页面实际为准）：

```tsx
  const hasActiveFilters =
    activeCategories.size > 0 ||
    activeStyles.size > 0 ||
    activeScenes.size > 0 ||
    activePlatforms.size > 0 ||
    query.trim().length > 0;
  const heading = formatCasesHeading(totalCount, matchedCount, hasActiveFilters);
```

3. h1（约 :335）改 `{heading.text}`。
4. 新增 effect 同步标题：

```tsx
  useEffect(() => {
    document.title = formatCasesDocumentTitle(totalCount, matchedCount, hasActiveFilters);
  }, [totalCount, matchedCount, hasActiveFilters]);
```

- [ ] **Step 6: 回归 + 浏览器验证**

Run: `npx tsc -b --noEmit && node --test src/lib/*.test.mjs src/pages/*.test.mjs`

```bash
chrome-devtools navigate_page --url "http://localhost:5173/cases" --timeout 30000
chrome-devtools evaluate_script "() => { const chip=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='人像写真'); chip.click(); return location.search; }"
sleep 2
chrome-devtools evaluate_script "() => ({ h1: document.querySelector('h1')?.textContent, title: document.title })"
```

Expected: h1 = "筛选出 … 个案例"，title 以"筛选出"开头；点"清除"后恢复默认文案。

- [ ] **Step 7: Commit**

```bash
git add src/lib/cases-heading-core.mjs src/lib/cases-heading-core.d.mts src/lib/cases-heading-core.test.mjs src/pages/CasesPage.tsx
git commit -m "feat(cases): H1 and document.title reflect active filter result count"
```

---

### Task 11: 模板变量填写表单（remix 闭环）

**Files:**
- Modify: `src/lib/template-discovery.mjs`（共享正则 + applyTemplateVariables）
- Modify: `src/lib/phase4-discovery.test.mjs`（追加用例）
- Modify: `src/pages/TemplateDetailPage.tsx:54,192-210`（变量表单 + 实时替换预览 + 复制填好的 Prompt）

**Interfaces:**
- Produces: `applyTemplateVariables(prompt: string, values?: Record<string, string>) => string`——`{argument name="X" default="Y"}` 替换为 `values[X]`（空/缺省用 default）；无标记 prompt 原样返回。与 `extractTemplateVariables` 共享同一正则常量 `ARGUMENT_PATTERN`。
- TemplateDetailPage 内部 state：`variableValues: Record<string, string>`。

- [ ] **Step 1: 写失败测试**

`src/lib/phase4-discovery.test.mjs` 追加：

```js
import { applyTemplateVariables, extractTemplateVariables } from "./template-discovery.mjs";

const PROMPT = '拍摄{argument name="背景色" default="纯正大红"}背景的证件照，妆容为{argument name="妆容强度" default="浓艳"}舞台妆。';

test("applyTemplateVariables substitutes provided values", () => {
  const out = applyTemplateVariables(PROMPT, { 背景色: "深蓝", 妆容强度: "裸感" });
  assert.ok(out.includes("深蓝"));
  assert.ok(out.includes("裸感"));
  assert.ok(!out.includes("{argument"));
});

test("applyTemplateVariables falls back to defaults for missing/blank values", () => {
  const out = applyTemplateVariables(PROMPT, { 背景色: "  " });
  assert.ok(out.includes("纯正大红"));
  assert.ok(out.includes("浓艳"));
  assert.ok(!out.includes("{argument"));
});

test("applyTemplateVariables passes through prompts without markers", () => {
  assert.equal(applyTemplateVariables("没有变量的提示词"), "没有变量的提示词");
});

test("extract and apply agree on variable names", () => {
  const vars = extractTemplateVariables(PROMPT).map((v) => v.name);
  assert.deepEqual(vars, ["背景色", "妆容强度"]);
});
```

（若该文件顶部已有 template-discovery 的 import，合并之。）

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test src/lib/phase4-discovery.test.mjs`
Expected: FAIL（applyTemplateVariables 不存在）。

- [ ] **Step 3: 实现 applyTemplateVariables（并共享正则）**

`src/lib/template-discovery.mjs`：把 `extractTemplateVariables` 内的局部 `pattern` 提升为模块级常量，并新增函数：

```js
const ARGUMENT_PATTERN =
  /\{argument\s+name=(?:"([^"]+)"|'([^']+)'|([^\s}]+))(?:\s+default=(?:"([^"]*)"|'([^']*)'|([^\s}]+)))?[^}]*\}/g;

export function extractTemplateVariables(prompt) {
  const variables = [];
  const seen = new Set();
  for (const match of String(prompt ?? "").matchAll(ARGUMENT_PATTERN)) {
    const name = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    variables.push({
      name,
      defaultValue: (match[4] ?? match[5] ?? match[6] ?? "").trim(),
    });
  }
  return variables;
}

/**
 * Substitute {argument} markers with user values (blank/missing → default).
 * Prompts without markers pass through untouched, so the copy button can
 * always call this unconditionally.
 */
export function applyTemplateVariables(prompt, values = {}) {
  return String(prompt ?? "").replace(
    ARGUMENT_PATTERN,
    (match, n1, n2, n3, d1, d2, d3) => {
      const name = (n1 ?? n2 ?? n3 ?? "").trim();
      const fallback = (d1 ?? d2 ?? d3 ?? "").trim();
      const given = String(values?.[name] ?? "").trim();
      return given || fallback || match;
    },
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test src/lib/phase4-discovery.test.mjs`
Expected: PASS（含既有用例）。

- [ ] **Step 5: TemplateDetailPage 变量表单**

`src/pages/TemplateDetailPage.tsx`：

1. import 增加：

```tsx
import { applyTemplateVariables, extractTemplateVariables } from "../lib/template-discovery.mjs";
```

（与既有 extractTemplateVariables 导入合并；若当前从别处导入则统一到本模块。）

2. 组件体内（`const variables = extractTemplateVariables(t.prompt);` 约 :54 之后）加：

```tsx
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const displayPrompt =
    variables.length > 0 ? applyTemplateVariables(t.prompt, variableValues) : t.prompt;
```

3. `charCount` / `promptLines` 的计算源从 `t.prompt` 改为 `displayPrompt`（保持既有截断/计数逻辑不变，仅换输入）。
4. `handleCopy` 内复制对象从 `t.prompt` 改为 `displayPrompt`。
5. VARIABLES 区块（:192-212）的 `<dl>` 整体替换为表单：

```tsx
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {variables.map((variable) => (
                    <label
                      key={`${t.id}-${variable.name}`}
                      className="block rounded-lg border border-white/[0.06] bg-ink-950/35 px-3 py-2.5"
                    >
                      <span className="block text-[12px] font-medium text-ink-100">
                        {variable.name}
                      </span>
                      <input
                        type="text"
                        value={variableValues[variable.name] ?? ""}
                        placeholder={variable.defaultValue || "按当前任务填写"}
                        onChange={(event) =>
                          setVariableValues((prev) => ({
                            ...prev,
                            [variable.name]: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-md border border-white/10 bg-ink-950/60 px-2.5 py-1.5 text-[12.5px] text-ink-100 placeholder:text-ink-600 focus:border-ember-500/50 focus:outline-none"
                      />
                      <span className="mt-1 block text-[11px] leading-relaxed text-ink-500">
                        默认：{variable.defaultValue || "按当前任务填写"}
                      </span>
                    </label>
                  ))}
                </div>
```

6. Prompt 展示区（`<pre>`/正文渲染处）的文本源从 `t.prompt` 改为 `displayPrompt`（保持既有排版类名）。

- [ ] **Step 6: 回归 + 浏览器验证**

Run: `npx tsc -b --noEmit && node --test src/lib/*.test.mjs src/pages/*.test.mjs`

```bash
chrome-devtools navigate_page --url "http://localhost:5173/template/derived-red-backdrop-glam-id-portrait" --timeout 30000
sleep 2
chrome-devtools evaluate_script "() => { const inputs=[...document.querySelectorAll('input[type=text]')]; return { count: inputs.length, placeholders: inputs.map(i=>i.placeholder) }; }"
```

Expected: `count` 等于该模板变量数（2），placeholders 含默认值。再手动在第一个输入框填值，截图确认 Prompt 预览实时替换、复制按钮复制的是替换后文本。

- [ ] **Step 7: Commit**

```bash
git add src/lib/template-discovery.mjs src/lib/phase4-discovery.test.mjs src/pages/TemplateDetailPage.tsx
git commit -m "feat(templates): fillable variable form with live prompt substitution and copy"
```

---

### Task 12: 全量回归与收尾

**Files:** 无新改动；验证 + 台账。

- [ ] **Step 1: 全套检查**

Run: `npm run check && npm run build`
Expected: 全绿。postbuild 会重建 sitemap/404/meta pages——确认 `dist/case/<slug>.html` 仍生成（抽查任一 slug 的 HTML 含 `<title` 与 JSON-LD）。

```bash
ls dist/case/ti-shi-ci-30287.html && grep -c "application/ld+json" dist/case/ti-shi-ci-30287.html
```

- [ ] **Step 2: 浏览器全流程回归（桌面 + 移动）**

桌面 1440×900：首页（stats/标题数字、卡片元信息、分类瓦片计数）、/cases（全中文 chip + 计数徽标 + 搜"动漫"有结果 + 人像写真计数≈5448）、任一案例详情、模板详情（变量表单替换）、深浅色切换。
移动 390×844（`chrome-devtools resize_page 390 844`）：首页、/cases 筛选抽屉、详情页粘性复制栏。截图存 `$TMP/taostudio-wave2/` 并逐张 Read 判定。

- [ ] **Step 3: 数据一致性抽查**

```bash
node -e "
const d=require('./public/data/cases.json');
const bad=d.filter(r=>r.title==='提示词：'||r.promptPreview==='null');
const f=require('./public/data/filter-options.json');
console.log('bad rows:', bad.length, '| styles:', f.styles.length, '| scenes:', f.scenes.length, '| counts attached:', !!f.styleCounts);
if(bad.length || !f.styleCounts) process.exit(1);
"
```

Expected: `bad rows: 0`、counts attached: true。

- [ ] **Step 4: 台账与汇报**

在 `.superpowers/sdd/progress.md`（若用子代理驱动）记录每任务 commit；向用户汇报结果与「push/部署待指示」。

---

## 本 wave 明确不做（Deferred，待用户点名再排）

- wsrv.nl 图片本地化（Wave-2 遗留，涉及 COS 上传链路）。
- 详情页"下载图片"按钮与收藏跨设备说明。
- 移动端 logo 品牌名、masonry 留白、筛选面板默认折叠高度。
- Prompt 中英切换对无翻译案例的禁用态（需 promptEn 存在性预知，涉及数据面）。
- Search Console 收录核查（上线 1-2 周后）。

## 执行方式

按 superpowers:subagent-driven-development 执行：每任务一个新实现者子代理 + 一个任务审查者；Task 4→5、Task 6→7→8 有依赖必须顺序执行，Task 1/2/3、9、10、11 相互独立可并行。执行顺序建议：1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12。
