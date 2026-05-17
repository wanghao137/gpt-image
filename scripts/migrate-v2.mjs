/**
 * One-shot migration: enrich every case with SEO + structural fields.
 *
 * Adds (without removing anything):
 *   - slug          SEO-friendly URL piece, e.g. "ren-wu-fa-xing-she-ji-100004"
 *   - ratio         "9:16" | "4:5" | "1:1" | "3:4" | "16:9" | "2:3" (heuristic from category/tags)
 *   - platforms     ["xiaohongshu","wechat","douyin","ec"] (heuristic)
 *   - userCategory  user-intent bucket: "xhs-cover" | "merchant-poster" | "portrait" | ...
 *   - commercialOk  "personal" | "commercial" | "ask" (default "ask")
 *   - difficulty    1-5 (heuristic)
 *   - seoTitle      "<title> · GPT-Image 2 Prompt | <userCategory>"
 *   - seoDescription truncated promptPreview + value tail
 *   - createdAt     ISO timestamp (only filled if missing)
 *
 * Idempotent: running twice changes nothing. Safe to run as a `prebuild` step.
 *
 * Usage:
 *   node scripts/migrate-v2.mjs                # in-place migrate public/data/cases.json
 *   node scripts/migrate-v2.mjs --dry          # print what would change
 *   node scripts/migrate-v2.mjs --check        # exit 1 if any case is missing v2 fields
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pinyin } from "pinyin-pro";

const ROOT = resolve(process.cwd());
const CASES_PATH = resolve(ROOT, "public/data/cases.json");

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry");
const CHECK = args.has("--check");

// ───────────────────────────────────────────── slug ──

/** Slugify Chinese / mixed text to lowercase ASCII, keeping IDs unique. */
function toSlug(title, id) {
  const py = pinyin(String(title || ""), { toneType: "none", type: "string", v: true });
  const base = py
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8) // cap length so URLs don't get unreadable
    .join("-");
  const safe = base || "case";
  return `${safe}-${id}`;
}

// ───────────────────────────────────────── user category ──

/**
 * Map a case to one user-intent bucket. Order matters: most specific first.
 * Returns the *primary* bucket only (a case is allowed to appear in multiple
 * via a separate `userCategories` field if we extend later).
 */
function inferUserCategory(c) {
  const t = `${c.title || ""} ${c.category || ""} ${(c.tags || []).join(" ")} ${(c.scenes || []).join(" ")} ${(c.styles || []).join(" ")}`.toLowerCase();
  const has = (kw) => kw.some((k) => t.includes(k.toLowerCase()));

  if (has(["小红书", "xhs", "xiaohongshu", "redbook"])) return "xhs-cover";
  if (has(["朋友圈", "九宫格"])) return "wechat-grid";
  if (has(["商家", "促销", "campaign", "宣传", "billboard", "advertisement", "广告"]))
    return "merchant-poster";
  if (has(["儿童", "全家福", "亲子", "kids"])) return "kids-portrait";
  if (has(["写真", "人像", "portrait", "肖像", "证件照"])) return "portrait";
  if (has(["3d", "玩具", "ip", "手办", "潮玩"])) return "3d-ip";
  if (has(["产品", "电商", "ecommerce", "包装", "fmcg", "product"])) return "ecommerce";
  if (has(["旅行", "城市", "travel", "city", "landmark", "地标"])) return "travel-poster";
  if (has(["品牌", "logo", "brand", "kv", "vi", "identity"])) return "brand-kv";
  if (has(["节日", "春节", "中秋", "圣诞", "holiday", "festival"])) return "festival";
  if (has(["信息图", "infographic", "图谱", "图鉴", "百科", "knowledge"])) return "infographic";
  if (has(["表情包", "头像", "贴纸", "emoji", "sticker", "avatar"])) return "sticker";
  if (has(["ui", "界面", "dashboard", "screenshot", "截图"])) return "ui-screenshot";
  if (has(["海报", "poster", "排版"])) return "poster-general";
  if (has(["插画", "illustration", "art", "watercolor", "水彩"])) return "illustration";
  if (has(["历史", "古典", "history", "dynasty", "古风", "scroll"])) return "classical";
  if (has(["故事", "storyboard", "scene", "叙事", "分镜"])) return "storyboard";
  if (has(["建筑", "architecture", "interior", "室内", "空间"])) return "architecture";
  return "other";
}

/** Pretty Chinese label for each bucket. Used by the UI directly. */
export const USER_CATEGORY_LABEL = {
  "xhs-cover": "小红书封面",
  "wechat-grid": "朋友圈九宫格",
  "merchant-poster": "商家海报",
  "portrait": "人像写真",
  "kids-portrait": "儿童·全家福",
  "3d-ip": "3D · IP 形象",
  "ecommerce": "电商产品图",
  "travel-poster": "城市旅行海报",
  "brand-kv": "品牌 KV / Logo",
  "festival": "节日营销",
  "infographic": "信息图 · 知识海报",
  "sticker": "表情包 · 头像",
  "ui-screenshot": "UI 截图",
  "poster-general": "通用海报",
  "illustration": "插画与艺术",
  "classical": "历史 · 古风",
  "storyboard": "场景 · 分镜",
  "architecture": "建筑 · 空间",
  "other": "其他用例",
};

// ───────────────────────────────────────────── ratio ──

/** Best-effort ratio inference from prompt + category hints. */
function inferRatio(c) {
  const t = `${c.title || ""} ${c.promptPreview || ""}`.toLowerCase();
  // Explicit ratios in prompt text win.
  const explicit = t.match(/\b(9\s*[:×x]\s*16|16\s*[:×x]\s*9|3\s*[:×x]\s*4|4\s*[:×x]\s*5|2\s*[:×x]\s*3|1\s*[:×x]\s*1|a4)\b/);
  if (explicit) {
    const v = explicit[1].replace(/\s+/g, "").replace(/[×x]/, ":");
    if (v === "a4") return "3:4";
    return v;
  }
  // Heuristic per category.
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

function inferPlatforms(c) {
  const t = `${c.title || ""} ${c.promptPreview || ""} ${(c.tags || []).join(" ")}`.toLowerCase();
  const list = [];
  if (/小红书|xhs|xiaohongshu|9:16/.test(t)) list.push("xiaohongshu");
  if (/朋友圈|wechat|九宫格/.test(t)) list.push("wechat");
  if (/抖音|tiktok|douyin/.test(t)) list.push("douyin");
  if (/电商|淘宝|天猫|商品|product|ecommerce/.test(t)) list.push("ec");
  if (/海报|poster|outdoor|户外/.test(t)) list.push("offline");
  if (list.length === 0) {
    // Sensible fallback by ratio.
    const ratio = inferRatio(c);
    if (ratio === "9:16") list.push("xiaohongshu", "douyin");
    else if (ratio === "1:1") list.push("ec");
    else list.push("wechat");
  }
  return Array.from(new Set(list));
}

// ───────────────────────────────────────── difficulty ──

function inferDifficulty(c) {
  const len = (c.promptPreview || "").length;
  if (len > 500) return 5;
  if (len > 300) return 4;
  if (len > 180) return 3;
  if (len > 80) return 2;
  return 1;
}

// ───────────────────────────────────────────── SEO ──

function clip(s, n) {
  if (!s) return "";
  const flat = String(s).replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n - 1) + "…" : flat;
}

function buildSeo(c, userCategory) {
  const label = USER_CATEGORY_LABEL[userCategory] || userCategory;
  const seoTitle = `${c.title} · GPT-Image 2 Prompt 案例 | ${label}`;
  const tail = "中英双语 Prompt，一键复制，快速复用。";
  const head = clip(c.promptPreview || c.title, 110);
  const seoDescription = `${head}—— ${tail}`;
  return { seoTitle, seoDescription };
}

// ───────────────────────────────────── main loop ──

const raw = JSON.parse(readFileSync(CASES_PATH, "utf8"));
const seenSlugs = new Map();
let changed = 0;
let missing = 0;

const next = raw.map((c) => {
  const out = { ...c };
  let touched = false;

  if (!out.slug) {
    let s = toSlug(out.title, out.id);
    // de-dup just in case (different titles → same pinyin)
    if (seenSlugs.has(s)) s = `${s}-${seenSlugs.get(s) + 1}`;
    seenSlugs.set(s, (seenSlugs.get(s) || 0) + 1);
    out.slug = s;
    touched = true;
  } else {
    seenSlugs.set(out.slug, (seenSlugs.get(out.slug) || 0) + 1);
  }

  if (!out.userCategory) {
    out.userCategory = inferUserCategory(out);
    touched = true;
  }
  if (!out.ratio) {
    out.ratio = inferRatio(out);
    touched = true;
  }
  if (!out.platforms || out.platforms.length === 0) {
    out.platforms = inferPlatforms(out);
    touched = true;
  }
  if (!out.commercialOk) {
    out.commercialOk = "ask";
    touched = true;
  }
  if (!out.difficulty) {
    out.difficulty = inferDifficulty(out);
    touched = true;
  }
  if (!out.seoTitle || !out.seoDescription) {
    const seo = buildSeo(out, out.userCategory);
    out.seoTitle = out.seoTitle || seo.seoTitle;
    out.seoDescription = out.seoDescription || seo.seoDescription;
    touched = true;
  }
  if (!out.createdAt) {
    // Older entries: stamp with a stable date so detail pages can show "added on".
    out.createdAt = new Date(2025, 0, 1).toISOString();
    touched = true;
  }

  if (touched) {
    changed += 1;
    missing += 1;
  }
  return out;
});

if (CHECK) {
  if (missing > 0) {
    console.error(`✗ ${missing} cases missing v2 fields`);
    process.exit(1);
  }
  console.log(`✓ all ${raw.length} cases have v2 fields`);
  process.exit(0);
}

if (DRY) {
  console.log(`would update ${changed} of ${raw.length} cases`);
  process.exit(0);
}

if (changed === 0) {
  console.log(`✓ all ${raw.length} cases already at v2 — nothing to do`);
  process.exit(0);
}

writeFileSync(CASES_PATH, JSON.stringify(next), "utf8");
console.log(`✓ migrated ${changed} of ${raw.length} cases → ${CASES_PATH}`);
