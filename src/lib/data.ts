/**
 * Data API for the React tree — dual-mode (SSG full / Client sharded).
 *
 * ── ARCHITECTURE ──
 *
 * cases.json is statically imported ONLY when `import.meta.env.SSR` is true
 * (the SSG server build). In the client build, Vite statically replaces
 * `import.meta.env.SSR` with `false`, making the entire conditional block
 * dead code. Rollup tree-shakes the import away, so cases.json never enters
 * the client JS bundle.
 *
 *   SSG (Node build):
 *     ALL_CASES has the full 12K+ dataset. getStaticPaths, server rendering,
 *     and all lookup functions work normally.
 *
 *   Client (browser):
 *     ALL_CASES is []. SSG'd pages hydrate from inline HTML.
 *     SPA fallback pages use loadShard / loadCaseIndex.
 */
import type { PromptCase, PromptTemplate, UserCategoryKey } from "../types";
import { sortTemplatesForDisplay } from "./templateSort";
import { fetchWithTimeout } from "./fetchWithTimeout";
// Templates are small (~134KB raw / ~48KB gzip) — safe to statically import
// in BOTH SSG and client bundles. Unlike cases.json (7.4MB), templates don't
// need sharding.
import templatesJson from "../../public/data/templates.json";
import homeData from "../../public/data/cases-home.json";

const DATA_REVISION = (homeData as { revision: string }).revision;

const USER_CATEGORY_KEYS: ReadonlySet<string> = new Set<UserCategoryKey>([
  "xhs-cover",
  "wechat-grid",
  "merchant-poster",
  "portrait",
  "kids-portrait",
  "3d-ip",
  "ecommerce",
  "travel-poster",
  "brand-kv",
  "festival",
  "infographic",
  "sticker",
  "ui-screenshot",
  "poster-general",
  "illustration",
  "classical",
  "storyboard",
  "architecture",
  "game-asset",
  "other",
]);

// ── SSG data loading ──────────────────────────────────────────────────
// data-ssg.ts is imported synchronously. Vite's SSR build bundles it; the
// client build never reaches this code because import.meta.env.SSR is false.
let SSG_CASES: PromptCase[] = [];

if (import.meta.env.SSR) {
  // Dynamic import resolved at SSR build time. Vite externalizes node:fs in
  // SSR mode. The client build sees `if (false)` and eliminates this block.
  const ssg = await import("./data-ssg");
  SSG_CASES = ssg.SSG_ALL_CASES;
}

// ── SSG validation ────────────────────────────────────────────────────

function validateCases(raw: unknown): PromptCase[] {
  if (!Array.isArray(raw)) {
    throw new Error(`[data] cases must be an array, got ${typeof raw}`);
  }
  const slugs = new Set<string>();
  raw.forEach((c, i) => {
    const where = `cases[${i}] (id=${(c as { id?: unknown })?.id ?? "?"})`;
    if (!c || typeof c !== "object") throw new Error(`[data] ${where} is not an object`);
    const rec = c as Record<string, unknown>;
    for (const field of ["id", "slug", "title", "imageUrl", "ratio", "userCategory", "createdAt"]) {
      if (typeof rec[field] !== "string" || (rec[field] as string).length === 0) {
        throw new Error(`[data] ${where} missing required string field "${field}"`);
      }
    }
    if (!USER_CATEGORY_KEYS.has(rec.userCategory as string)) {
      throw new Error(
        `[data] ${where} has unknown userCategory "${rec.userCategory}". ` +
          `Add it to UserCategoryKey + USER_CATEGORIES, or fix the classifier.`,
      );
    }
    if (rec.userCategories !== undefined) {
      if (!Array.isArray(rec.userCategories)) {
        throw new Error(`[data] ${where} userCategories must be an array`);
      }
      for (const k of rec.userCategories as unknown[]) {
        if (!USER_CATEGORY_KEYS.has(k as string)) {
          throw new Error(`[data] ${where} has unknown secondary userCategory "${k}"`);
        }
      }
    }
    for (const arrField of ["tags", "styles", "scenes", "platforms"]) {
      if (rec[arrField] !== undefined && !Array.isArray(rec[arrField])) {
        throw new Error(`[data] ${where} field "${arrField}" must be an array when present`);
      }
    }
    if (slugs.has(rec.slug as string)) {
      throw new Error(`[data] duplicate slug "${rec.slug}" at ${where}`);
    }
    slugs.add(rec.slug as string);
  });
  return raw as PromptCase[];
}

const shouldValidate = import.meta.env.SSR || import.meta.env.DEV;

// ── Public exports ────────────────────────────────────────────────────

export const ALL_CASES: PromptCase[] = shouldValidate
  ? validateCases(SSG_CASES)
  : SSG_CASES;

export const ALL_TEMPLATES: PromptTemplate[] = templatesJson as PromptTemplate[];

// ── SSG-mode indexes ──────────────────────────────────────────────────

const BY_SLUG = new Map<string, PromptCase>(ALL_CASES.map((c) => [c.slug, c]));
const BY_ID = new Map<string, PromptCase>(ALL_CASES.map((c) => [c.id, c]));
const INDEX_BY_ID = new Map<string, number>(ALL_CASES.map((_c, i) => [ALL_CASES[i].id, i]));

export function getCaseBySlug(slug: string): PromptCase | undefined {
  return BY_SLUG.get(slug);
}

export function getCaseById(id: string): PromptCase | undefined {
  return BY_ID.get(id);
}

/** Cases grouped by user-intent bucket. SSG-only (returns [] in client). */
export function casesByUserCategory(key: string): PromptCase[] {
  return ALL_CASES.filter(
    (c) => c.userCategory === key || (c.userCategories ?? []).includes(key as never),
  );
}

/** "Related" picks. SSG-only (returns [] in client). */
export function relatedCases(c: PromptCase, n = 6): PromptCase[] {
  const sameBucket = ALL_CASES.filter(
    (other) => other.id !== c.id && other.userCategory === c.userCategory,
  );
  if (sameBucket.length >= n) return sameBucket.slice(0, n);

  const tagSet = new Set([...(c.tags ?? []), ...(c.styles ?? []), ...(c.scenes ?? [])]);
  const byTag = ALL_CASES.filter(
    (other) =>
      other.id !== c.id &&
      other.userCategory !== c.userCategory &&
      [...(other.tags ?? []), ...(other.styles ?? []), ...(other.scenes ?? [])].some((t) => tagSet.has(t)),
  );
  return [...sameBucket, ...byTag].slice(0, n);
}

/** Sequential prev/next. SSG-only (returns {} in client). */
export function caseNeighbors(c: PromptCase): {
  prev?: PromptCase;
  next?: PromptCase;
} {
  const i = INDEX_BY_ID.get(c.id);
  if (i === undefined) return {};
  return {
    prev: i + 1 < ALL_CASES.length ? ALL_CASES[i + 1] : undefined,
    next: i > 0 ? ALL_CASES[i - 1] : undefined,
  };
}

// ── Template lookups ──────────────────────────────────────────────────

const TEMPLATES_SORTED = sortTemplatesForDisplay(ALL_TEMPLATES);
const TEMPLATE_BY_ID = new Map<string, PromptTemplate>(
  TEMPLATES_SORTED.map((t) => [t.id, t]),
);
const TEMPLATE_INDEX = new Map<string, number>(
  TEMPLATES_SORTED.map((_t, i) => [TEMPLATES_SORTED[i].id, i]),
);

export function getTemplateById(id: string): PromptTemplate | undefined {
  return TEMPLATE_BY_ID.get(id);
}

export function templateNeighbors(t: PromptTemplate): {
  prev?: PromptTemplate;
  next?: PromptTemplate;
} {
  const i = TEMPLATE_INDEX.get(t.id);
  if (i === undefined) return {};
  return {
    prev: i > 0 ? TEMPLATES_SORTED[i - 1] : undefined,
    next: i + 1 < TEMPLATES_SORTED.length ? TEMPLATES_SORTED[i + 1] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Client-side shard loading (mirrors usePrompt.ts pattern)
// ---------------------------------------------------------------------------

const shardCache = new Map<string, PromptCase[]>();
const shardInflight = new Map<string, Promise<PromptCase[]>>();

/** Fetch a category shard from public/data/cases-<category>.json. */
export function loadShard(category: string): Promise<PromptCase[]> {
  if (shardCache.has(category)) return Promise.resolve(shardCache.get(category)!);
  if (shardInflight.has(category)) return shardInflight.get(category)!;

  const url = `${import.meta.env.BASE_URL}data/cases-${category}.json?v=${DATA_REVISION}`;
  const promise = fetchWithTimeout(url, { cache: "force-cache", timeoutMs: 10000 })
    .then((r) => {
      if (!r.ok) throw new Error(`shard ${category}: ${r.status}`);
      return r.json();
    })
    .then((data: PromptCase[]) => {
      shardCache.set(category, data);
      shardInflight.delete(category);
      return data;
    })
    .catch((err) => {
      shardInflight.delete(category);
      throw err;
    });

  shardInflight.set(category, promise);
  return promise;
}

/** Get cached shard synchronously, or undefined. */
export function getCachedShard(category: string): PromptCase[] | undefined {
  return shardCache.get(category);
}

const browsePageCache = new Map<number, PromptCase[]>();
const browsePageInflight = new Map<number, Promise<PromptCase[]>>();

/** Fetch one globally ordered browse page. Unlike category shards, pages do not overlap. */
export function loadBrowsePage(page: number): Promise<PromptCase[]> {
  if (browsePageCache.has(page)) return Promise.resolve(browsePageCache.get(page)!);
  if (browsePageInflight.has(page)) return browsePageInflight.get(page)!;

  const filename = `page-${String(page).padStart(3, "0")}.json`;
  const url = `${import.meta.env.BASE_URL}data/browse/${filename}?v=${DATA_REVISION}`;
  const promise = fetchWithTimeout(url, { cache: "force-cache", timeoutMs: 10000 })
    .then((response) => {
      if (!response.ok) throw new Error(`browse page ${page}: ${response.status}`);
      return response.json();
    })
    .then((data: PromptCase[]) => {
      browsePageCache.set(page, data);
      browsePageInflight.delete(page);
      return data;
    })
    .catch((error) => {
      browsePageInflight.delete(page);
      throw error;
    });

  browsePageInflight.set(page, promise);
  return promise;
}

export function getCachedBrowsePages(): PromptCase[][] {
  const pages: PromptCase[][] = [];
  for (let index = 0; browsePageCache.has(index); index += 1) {
    pages.push(browsePageCache.get(index)!);
  }
  return pages;
}

// ── cases-index.json loading ──

export interface CaseIndexEntry {
  id: string;
  slug: string;
  uc: string;
  r: string;
}

let caseIndexCache: CaseIndexEntry[] | null = null;
let caseIndexInflight: Promise<CaseIndexEntry[]> | null = null;

/** Fetch the lightweight cases-index.json for SPA case lookup. */
export function loadCaseIndex(): Promise<CaseIndexEntry[]> {
  if (caseIndexCache) return Promise.resolve(caseIndexCache);
  if (caseIndexInflight) return caseIndexInflight;

  const url = `${import.meta.env.BASE_URL}data/cases-index.json?v=${DATA_REVISION}`;
  caseIndexInflight = fetchWithTimeout(url, { cache: "force-cache", timeoutMs: 10000 })
    .then((r) => {
      if (!r.ok) throw new Error(`cases-index: ${r.status}`);
      return r.json();
    })
    .then((data: CaseIndexEntry[]) => {
      caseIndexCache = data;
      caseIndexInflight = null;
      return data;
    })
    .catch((err) => {
      caseIndexInflight = null;
      throw err;
    });

  return caseIndexInflight;
}

/** Synchronous index lookup if cached. */
export function getCachedCaseIndex(): CaseIndexEntry[] | null {
  return caseIndexCache;
}
