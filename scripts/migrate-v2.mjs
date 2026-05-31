/**
 * Migration: enrich every case with SEO + structural fields.
 *
 * v2 (initial)  added: slug / ratio / userCategory / platforms / createdAt
 * v2.1          rewrites: userCategory + userCategories[] using the shared,
 *                         unit-tested scoring classifier in classify-core.mjs
 *                         so the buckets users actually search for ("小红书封面",
 *                         "商家海报", "人像写真"…) are accurate.
 * v2.2          stops persisting derivable/unused fields. `seoTitle` /
 *                         `seoDescription` are now derived at render time
 *                         (src/lib/seo-url.mjs `deriveCaseSeo`); `difficulty`
 *                         and `commercialOk` were never rendered. Dropping them
 *                         trims ~160 KB raw (~10 KB gzip) from the data chunk
 *                         that EVERY page downloads.
 *
 * Writes/keeps (without removing source fields):
 *   - slug              SEO-friendly URL piece
 *   - ratio             "9:16" | "4:5" | "1:1" | "3:4" | "16:9" | "2:3"
 *   - platforms         ["xiaohongshu","wechat","douyin","ec","offline"]
 *   - userCategory      primary user-intent bucket
 *   - userCategories    extra buckets (1–2 secondaries) — used by category pages
 *   - createdAt         ISO date
 *
 * Strips (if present from older snapshots):
 *   - seoTitle / seoDescription / difficulty / commercialOk
 *
 * Idempotent at field level: existing v2 fields are kept, but `userCategory`
 * and `userCategories` are *re-derived* on every run so reclassification
 * improvements ship without manual editing. Pass --keep-categories to skip.
 *
 * Usage:
 *   node scripts/migrate-v2.mjs                # in-place migrate
 *   node scripts/migrate-v2.mjs --dry          # show what would change
 *   node scripts/migrate-v2.mjs --check        # exit 1 if v2 fields missing
 *   node scripts/migrate-v2.mjs --keep-categories
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pinyin } from "pinyin-pro";
import { classifyCase } from "./classify-core.mjs";
import {
  deriveTemplatesFromCases,
  getTemplateDerivationBase,
  mergeTemplateCollections,
  TARGET_TEMPLATE_COUNT,
} from "./template-derivation.mjs";

const ROOT = resolve(process.cwd());
const CASES_PATH = resolve(ROOT, "public/data/cases.json");
const TEMPLATES_PATH = resolve(ROOT, "public/data/templates.json");
const MERGED_CASES_SOURCE_URL = "/data/cases.json";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry");
const CHECK = args.has("--check");
const KEEP_CATS = args.has("--keep-categories");

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function writeFileWithRetry(path, data, encoding = "utf8") {
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      writeFileSync(path, data, encoding);
      return;
    } catch (error) {
      lastError = error;
      const code = error?.code;
      if (!["UNKNOWN", "EBUSY", "EPERM", "EACCES"].includes(code) || attempt === 7) {
        throw error;
      }
      sleepSync(75 * (attempt + 1));
    }
  }
  throw lastError;
}

// ───────────────────────────────────────────── slug ──

function toSlug(title, id) {
  const py = pinyin(String(title || ""), { toneType: "none", type: "string", v: true });
  const base = py
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join("-");
  const safe = base || "case";
  return `${safe}-${id}`;
}

// ───────────────────────────────────────── classifier ──
//
// The user-intent classifier (RULES, scoring, labels) now lives in the shared,
// unit-tested `scripts/classify-core.mjs` so migrate-v2, the admin automation
// core and any future caller all agree on one implementation. We only keep a
// thin adapter here that maps the old `classify(out)` call shape onto it.

function classify(c) {
  return classifyCase(c);
}

// ───────────────────────────────────────────── ratio ──

function inferRatio(c) {
  const t = `${c.title || ""} ${c.promptPreview || ""}`.toLowerCase();
  const explicit = t.match(
    /\b(9\s*[:×x]\s*16|16\s*[:×x]\s*9|3\s*[:×x]\s*4|4\s*[:×x]\s*5|2\s*[:×x]\s*3|1\s*[:×x]\s*1|a4|vertical\s+poster|portrait\s+9:?16)\b/,
  );
  if (explicit) {
    const v = explicit[1].replace(/\s+/g, "").replace(/[×x]/, ":");
    if (v === "a4" || v.startsWith("vertical") || v.startsWith("portrait")) return "3:4";
    return v;
  }
  const cat = c.category || "";
  if (/海报|Poster|排版/.test(cat)) return "9:16";
  if (/UI|界面|Dashboard|Screenshot/i.test(cat)) return "16:9";
  if (/信息图|Infographic|图表/.test(cat)) return "3:4";
  if (/角色|人物|Portrait|写真/.test(cat)) return "4:5";
  if (/产品|电商|Product/.test(cat)) return "1:1";
  if (/建筑|Architecture/.test(cat)) return "16:9";
  if (/场景|叙事|Storyboard/.test(cat)) return "16:9";
  return "4:5";
}

// ───────────────────────────────────────── platforms ──

function inferPlatforms(c, primary) {
  const t = `${c.title || ""} ${c.promptPreview || ""} ${(c.tags || []).join(" ")}`.toLowerCase();
  const list = [];
  if (/小红书|xhs|xiaohongshu|9:16/.test(t)) list.push("xiaohongshu");
  if (/朋友圈|wechat|九宫格|moments/.test(t)) list.push("wechat");
  if (/抖音|tiktok|douyin/.test(t)) list.push("douyin");
  if (/电商|淘宝|天猫|商品|product|ecommerce/.test(t)) list.push("ec");
  if (/海报|poster|outdoor|户外|印刷|billboard/.test(t)) list.push("offline");

  if (list.length === 0) {
    // Sensible fallback by primary bucket and ratio.
    const ratio = inferRatio(c);
    if (primary === "xhs-cover") list.push("xiaohongshu");
    else if (primary === "wechat-grid") list.push("wechat");
    else if (primary === "ecommerce") list.push("ec");
    else if (primary === "merchant-poster") list.push("offline", "wechat");
    else if (primary === "kids-portrait") list.push("wechat");
    else if (ratio === "9:16") list.push("xiaohongshu", "douyin");
    else if (ratio === "1:1") list.push("ec");
    else list.push("wechat");
  }
  return Array.from(new Set(list));
}

// ───────────────────────────────────────── difficulty ──
//
// `difficulty` and the SEO strings used to be computed here and persisted.
// They are no longer stored (difficulty is unused in the UI; SEO strings are
// derived at render time via src/lib/seo-url.mjs). The helpers were removed.

// ───────────────────────────────────── main loop ──

const raw = JSON.parse(readFileSync(CASES_PATH, "utf8"));
const seenSlugs = new Map();
let touchedCount = 0;
let categoryChanges = 0;

const next = raw.map((c) => {
  const out = { ...c };
  let touched = false;

  if (!out.slug) {
    let s = toSlug(out.title, out.id);
    if (seenSlugs.has(s)) s = `${s}-${(seenSlugs.get(s) || 0) + 1}`;
    seenSlugs.set(s, (seenSlugs.get(s) || 0) + 1);
    out.slug = s;
    touched = true;
  } else {
    seenSlugs.set(out.slug, (seenSlugs.get(out.slug) || 0) + 1);
  }

  // Always re-classify unless --keep-categories is passed.
  const { primary, secondaries } = classify(out);
  if (!KEEP_CATS) {
    if (out.userCategory !== primary) categoryChanges += 1;
    out.userCategory = primary;
    out.userCategories = secondaries;
    touched = true;
  } else {
    if (!out.userCategory) {
      out.userCategory = primary;
      out.userCategories = secondaries;
      touched = true;
    }
  }

  if (!out.ratio) {
    out.ratio = inferRatio(out);
    touched = true;
  }
  // Platforms: re-derive when missing or when primary category just changed.
  if (!out.platforms || out.platforms.length === 0 || !KEEP_CATS) {
    out.platforms = inferPlatforms(out, out.userCategory);
    touched = true;
  }
  if (!out.createdAt) {
    out.createdAt = new Date(2025, 0, 1).toISOString();
    touched = true;
  }

  // seoTitle / seoDescription / difficulty / commercialOk are NO LONGER
  // persisted — they're either derived at render time (SEO strings, see
  // src/lib/seo-url.mjs `deriveCaseSeo`) or unused in the UI. Strip any that
  // lingered from older snapshots so the data chunk every page downloads
  // stays lean (~160 KB raw / ~10 KB gzip saved).
  for (const dead of ["seoTitle", "seoDescription", "difficulty", "commercialOk"]) {
    if (dead in out) {
      delete out[dead];
      touched = true;
    }
  }

  if (touched) touchedCount += 1;
  return out;
});

if (CHECK) {
  const missing = next.filter((c) => !c.slug || !c.userCategory || !c.ratio).length;
  if (missing > 0) {
    console.error(`✗ ${missing} cases missing v2 fields`);
    process.exit(1);
  }
  console.log(`✓ all ${raw.length} cases have v2 fields`);
  process.exit(0);
}

if (DRY) {
  console.log(`would touch ${touchedCount} of ${raw.length} cases`);
  console.log(`would re-categorize ${categoryChanges} cases`);
  expandTemplates(next, { dry: true });
  process.exit(0);
}

writeFileWithRetry(CASES_PATH, JSON.stringify(next), "utf8");
console.log(
  `✓ migrated ${touchedCount} of ${raw.length} cases (${categoryChanges} re-categorized) → ${CASES_PATH}`,
);
expandTemplates(next);

function expandTemplates(cases, options = {}) {
  let templates;
  try {
    templates = JSON.parse(readFileSync(TEMPLATES_PATH, "utf8"));
  } catch (error) {
    console.warn(`! could not read templates for derivation: ${error.message}`);
    return;
  }
  if (!Array.isArray(templates)) {
    console.warn("! public/data/templates.json is not an array, skipping derivation");
    return;
  }

  const templateBase = getTemplateDerivationBase(templates);
  const derivedTemplates = deriveTemplatesFromCases(cases, templateBase, {
    sourceUrl: MERGED_CASES_SOURCE_URL,
  });
  const nextTemplates = mergeTemplateCollections({
    upstreamTemplates: templateBase,
    derivedTemplates,
    manualTemplates: [],
  });

  if (!options.dry) {
    writeFileWithRetry(TEMPLATES_PATH, JSON.stringify(nextTemplates, null, 2), "utf8");
  }

  console.log(
    `${options.dry ? "would expand" : "✓ expanded"} templates: base ${templateBase.length} + derived ${derivedTemplates.length} → ${nextTemplates.length} (target ${TARGET_TEMPLATE_COUNT})`,
  );
}
