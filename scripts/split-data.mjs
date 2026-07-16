/**
 * Data shard generator — runs AFTER migrate-v2.mjs (which enriches cases.json
 * with userCategory/slug/ratio/platforms) and AFTER build-images.mjs (which
 * rewrites imageUrl to /images/* paths).
 *
 * Reads the single public/data/cases.json (the "full" SSG data source) and
 * emits purpose-built shards so the client bundle NEVER imports the 7+ MB
 * monolith. Each page loads only the shard(s) it needs:
 *
 *   cases-index.json      — ultra-light [{id,slug,uc,r}] for SSG path
 *                           enumeration + SPA case lookup. ~150 KB gzip.
 *   cases-home.json       — pre-selected hero/strip/featured cases + tile
 *                           stats. The ONLY data the homepage needs. ~25 KB.
 *   cases-search.json     — [{id,t,c,uc,s,sc}] for CasesPage search index.
 *                           ~150 KB gzip.
 *   filter-options.json   — aggregated styles/scenes/platforms option lists.
 *   cases-<category>.json — one file per userCategory shard. 50-413 KB each.
 *
 * The original cases.json is PRESERVED on disk — it's still needed at SSG
 * build time (Node.js server side) for getStaticPaths and server rendering.
 * But it's no longer imported by the client bundle, so it never enters the
 * browser's download.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sortCasesForDisplay } from "./case-ordering.mjs";
import { selectHeroCases } from "../src/lib/home-hero-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_DIR = resolve(ROOT, "public/data");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(relativePath, data) {
  const output = resolve(ROOT, relativePath);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(data), "utf8");
}

/**
 * Homepage tile metadata. Mirrors the `pinnedHomepage` entries from
 * src/lib/userCategories.ts. Kept inline (not imported) because this is a
 * build-time .mjs script and we don't want a runtime .ts import dependency.
 * If userCategories.ts changes, update this list to match.
 */
const HOMEPAGE_TILES = [
  { key: "portrait", slug: "portrait", label: "人像写真", tagline: "韩系、胶片、写实人像，可加垫图保持身份" },
  { key: "poster-general", slug: "poster-general", label: "海报与排版", tagline: "活动、产品、节日、电影通用海报" },
  { key: "infographic", slug: "infographic", label: "信息图 · 知识海报", tagline: "百科图鉴、流程图、科普长图" },
  { key: "illustration", slug: "illustration", label: "插画与艺术", tagline: "水彩、水墨、纸艺、漫画风插画" },
  { key: "ecommerce", slug: "ecommerce", label: "电商产品图", tagline: "主图、详情页、包装与场景视觉" },
  { key: "merchant-poster", slug: "merchant-poster", label: "商家海报", tagline: "餐饮、美业、教培促销与节日宣传" },
  { key: "travel-poster", slug: "travel-poster", label: "城市旅行海报", tagline: "城市地标、复古旅游招贴、文字海报" },
  { key: "xhs-cover", slug: "xhs-cover", label: "小红书封面", tagline: "9:16 高点击封面，文字与构图直接可用" },
  { key: "classical", slug: "classical", label: "历史 · 古风", tagline: "朝代服饰、长卷叙事、东方神话" },
  { key: "architecture", slug: "architecture", label: "建筑 · 空间", tagline: "室内、建筑外观、城市空间" },
  { key: "ui-screenshot", slug: "ui-screenshot", label: "UI 截图", tagline: "App、网页、仪表盘高保真截图" },
  { key: "3d-ip", slug: "3d-ip", label: "3D · IP 形象", tagline: "潮玩盲盒、品牌吉祥物、Pixar 风角色" },
];

/**
 * Pick a stable seed for hero selection. We can't use a random seed here
 * (split-data runs at build time; the seed must be deterministic so the SSG'd
 * homepage HTML matches across rebuilds). The client will randomize after
 * hydration via createHeroSeed(), but the initial SSG render uses this seed.
 */
const STABLE_HERO_SEED = 42;
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;
// Timestamp tracking was bootstrapped with the existing 12K-case catalogue at
// this instant. Those baseline records were not genuinely new, so exclude the
// bootstrap cohort from the temporary 48h metric. Once the rolling cutoff
// passes this instant, the normal 48h rule takes over automatically.
const RECENT_TRACKING_BASELINE = Date.parse("2026-07-14T10:32:42.018Z");

function buildHomePayload(cases, now = Date.now()) {
  const sorted = sortCasesForDisplay(cases);
  const heroCases = selectHeroCases(sorted, { limit: 5, seed: STABLE_HERO_SEED });
  const heroIds = new Set(heroCases.map((c) => c.id));
  const stripCases = sorted.filter((c) => !heroIds.has(c.id)).slice(0, 14);
  const featured = sorted.slice(0, 12);

  // Tile stats for CategoryShowcase — pre-computed so the homepage doesn't
  // need the full dataset just to count per-category.
  const byKey = new Map();
  for (const c of sorted) {
    const arr = byKey.get(c.userCategory);
    if (arr) arr.push(c);
    else byKey.set(c.userCategory, [c]);
  }
  const tiles = HOMEPAGE_TILES.map((meta) => {
    const list = byKey.get(meta.key) ?? [];
    return {
      slug: meta.slug,
      label: meta.label,
      tagline: meta.tagline,
      count: list.length,
      cover: list[0]?.imageUrl,
    };
  }).filter((tile) => tile.count > 0);

  return {
    hero: stripLite(heroCases),
    strip: stripLite(stripCases),
    featured: stripLite(featured),
    tiles,
    totalCount: sorted.length,
    recentCount: sorted.filter((item) => {
      const createdAt = Date.parse(item.createdAt);
      const cutoff = Math.max(now - RECENT_WINDOW_MS, RECENT_TRACKING_BASELINE);
      return Number.isFinite(createdAt) && createdAt > cutoff && createdAt <= now;
    }).length,
  };
}

/**
 * Strip a case down to only the fields the card/grid rendering needs.
 * This removes prompt (already in prompts/<id>.json) and imageAlt (always
 * equals title — consumers use `|| title` fallback).
 */
function stripLite(cases) {
  return cases.map((c) => {
    const row = {
      id: c.id,
      slug: c.slug,
      title: c.title,
      category: c.category,
      imageUrl: c.imageUrl,
      promptPreview: c.promptPreview,
      source: c.source,
      createdAt: c.createdAt,
      userCategory: c.userCategory,
      ratio: c.ratio,
    };
    if (c.titleEn) row.titleEn = c.titleEn;
    if (c.tags?.length) row.tags = c.tags;
    if (c.styles?.length) row.styles = c.styles;
    if (c.scenes?.length) row.scenes = c.scenes;
    if (c.userCategories?.length) row.userCategories = c.userCategories;
    if (c.platforms?.length) row.platforms = c.platforms;
    if (c.githubUrl) row.githubUrl = c.githubUrl;
    return row;
  });
}

function buildSearchIndex(cases) {
  return cases.map((c) => ({
    id: c.id,
    t: c.title,
    c: c.category,
    uc: c.userCategory,
    s: c.styles ?? [],
    sc: c.scenes ?? [],
    p: c.platforms ?? [],
  }));
}

function buildIndex(cases) {
  return cases.map((c) => ({
    id: c.id,
    slug: c.slug,
    uc: c.userCategory,
    r: c.ratio,
  }));
}

function buildFilterOptions(cases) {
  const styles = new Set();
  const scenes = new Set();
  const platforms = new Set();
  for (const c of cases) {
    for (const s of c.styles ?? []) styles.add(s);
    for (const s of c.scenes ?? []) scenes.add(s);
    for (const p of c.platforms ?? []) platforms.add(p);
  }
  const sortZh = (a, b) => a.localeCompare(b, "zh-Hans-CN");
  return {
    styles: Array.from(styles).sort(sortZh),
    scenes: Array.from(scenes).sort(sortZh),
    platforms: Array.from(platforms).sort(sortZh),
  };
}

function main() {
  const casesPath = resolve(DATA_DIR, "cases.json");
  if (!existsSync(casesPath)) {
    console.warn("! public/data/cases.json not found — skipping split-data");
    return;
  }

  const cases = readJson(casesPath);
  if (!Array.isArray(cases) || cases.length === 0) {
    console.warn("! public/data/cases.json is empty — skipping split-data");
    return;
  }

  console.log(`split-data: processing ${cases.length} cases ...`);

  // ── cases-index.json ──
  const index = buildIndex(cases);
  writeJson("public/data/cases-index.json", index);
  console.log(`✓ cases-index.json: ${index.length} entries`);

  // ── cases-home.json ──
  const home = buildHomePayload(cases);
  writeJson("public/data/cases-home.json", home);
  console.log(
    `✓ cases-home.json: ${home.hero.length} hero + ${home.strip.length} strip + ${home.featured.length} featured + ${home.tiles.length} tiles`,
  );

  // ── cases-search.json ──
  const searchIndex = buildSearchIndex(cases);
  writeJson("public/data/cases-search.json", searchIndex);
  console.log(`✓ cases-search.json: ${searchIndex.length} entries`);

  // ── filter-options.json ──
  const filterOptions = buildFilterOptions(cases);
  writeJson("public/data/filter-options.json", filterOptions);
  console.log(
    `✓ filter-options.json: ${filterOptions.styles.length} styles, ${filterOptions.scenes.length} scenes, ${filterOptions.platforms.length} platforms`,
  );

  // ── cases-<category>.json shards ──
  // IMPORTANT: This must match casesByUserCategory() in src/lib/data.ts, which
  // includes BOTH primary userCategory AND secondary userCategories[]. A case
  // appears in every bucket it belongs to (primary + secondaries), so the sum
  // of shard sizes > total cases (cases with secondaries are counted in multiple
  // shards). This keeps SSG count == client shard count for consistency.
  const byCategory = new Map();
  for (const c of cases) {
    const keys = new Set([c.userCategory || "other"]);
    for (const sec of c.userCategories ?? []) keys.add(sec);
    for (const key of keys) {
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key).push(c);
    }
  }

  let totalShardSize = 0;
  for (const [category, items] of byCategory) {
    const sorted = sortCasesForDisplay(items);
    const shard = stripLite(sorted);
    writeJson(`public/data/cases-${category}.json`, shard);
    totalShardSize += JSON.stringify(shard).length;
  }
  console.log(
    `✓ ${byCategory.size} category shards written ` +
      `(raw total: ${Math.round(totalShardSize / 1024)} KB)`,
  );

  console.log("split-data: done.");
}

main();
