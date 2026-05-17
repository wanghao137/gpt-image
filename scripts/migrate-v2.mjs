/**
 * Migration: enrich every case with SEO + structural fields.
 *
 * v2 (initial)  added: slug / ratio / userCategory / platforms / commercialOk
 *                       / difficulty / seoTitle / seoDescription / createdAt
 * v2.1          rewrites: userCategory + userCategories[] using a far more
 *                         precise CN/EN keyword classifier so that the buckets
 *                         users actually search for ("小红书封面", "商家海报",
 *                         "人像写真"…) get a meaningful number of cases each.
 *
 * Adds (without removing anything):
 *   - slug              SEO-friendly URL piece
 *   - ratio             "9:16" | "4:5" | "1:1" | "3:4" | "16:9" | "2:3"
 *   - platforms         ["xiaohongshu","wechat","douyin","ec","offline"]
 *   - userCategory      primary user-intent bucket
 *   - userCategories    extra buckets (1–2 secondaries) — used by category pages
 *   - commercialOk      "personal" | "commercial" | "ask"
 *   - difficulty        1–5
 *   - seoTitle          for <title>
 *   - seoDescription    for <meta description>
 *   - createdAt         ISO date
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

const ROOT = resolve(process.cwd());
const CASES_PATH = resolve(ROOT, "public/data/cases.json");

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry");
const CHECK = args.has("--check");
const KEEP_CATS = args.has("--keep-categories");

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

/**
 * Each rule: array of regex patterns (case-insensitive). The first rule
 * whose patterns appear gets the bucket. Order = priority. Some buckets
 * appear twice (high-confidence and broad fallback).
 *
 * We classify against the JOINED text of:
 *   title + category + promptPreview + tags + styles + scenes
 */
const RULES = [
  // ── high-precision niche buckets first ──────────────────────────────
  {
    key: "kids-portrait",
    patterns: [
      /儿童|kid|baby|infant|todler|toddler|親子|亲子|全家福|家庭(写真|合影)|family\s+photo|kindergarten|幼儿|宝宝|小孩|学生.*毕业/,
    ],
  },
  {
    key: "wechat-grid",
    patterns: [/朋友圈|九宫格|wechat\s+moments|moments\s+grid|3x3\s+grid/],
  },
  {
    key: "festival",
    patterns: [
      /春节|新年|chinese\s+new\s+year|cny|中秋|端午|圣诞|christmas|双[0-9一二]+|双十一|双12|国庆|劳动节|spring\s+festival|holiday|festive|halloween|valentine|生日|birthday|节日营销|holiday\s+(poster|campaign)/,
    ],
  },
  {
    key: "sticker",
    patterns: [/表情包|emoji|贴纸|sticker\s+(pack|sheet|set)?|头像|avatar|profile\s+picture|pfp|微信表情/],
  },
  {
    key: "xhs-cover",
    patterns: [
      /小红书|xiaohongshu|xhs|redbook|red\s+book|rednote|小红薯/,
    ],
  },
  {
    key: "3d-ip",
    patterns: [
      /3d\s*(ip|character|toy|figurine|figure|玩偶|手办|盲盒|潮玩|chibi|q\s*版)/,
      /(收藏\s*玩具|可动\s*手办|blind\s*box)/,
      /(pixar|cute\s+3d\s+character|3d\s+mascot)/,
    ],
  },
  {
    key: "merchant-poster",
    patterns: [
      /餐饮|奶茶|饮品|烧烤|火锅|外卖|menu(?!\s*bar)|coffee\s+shop|restaurant\s+(poster|ad|menu)/,
      /美业|美容|美甲|理发|美发|sk\s*incare|spa\s+(poster|ad)/,
      /促销|大促|甩卖|限时|团购|清仓|开业|店庆|周年(庆|店)|卖货|sale|promo(tion)?\s+(poster|banner)|discount\s+poster/,
      /商家|店铺|门店|线下\s*海报|印刷|outdoor|billboard\s+ad|shop\s+window/,
      /教培|培训\s*海报|课程\s*海报|招生|公开课|education\s+poster/,
    ],
  },
  {
    key: "ecommerce",
    patterns: [
      /电商|淘宝|天猫|京东|拼多多|amazon|shopee|lazada|product\s+(listing|page|shot|hero|mockup)|主图|详情页|包装(图|设计|盒)|product\s+packaging/,
      /fmcg|cpg|护肤(产品|宣传)|skincare\s+ad|beauty\s+(ad|product)|beverage\s+ad/,
    ],
  },
  {
    key: "travel-poster",
    patterns: [
      /旅行|旅游|城市\s*(海报|插画|地图)|travel\s+(poster|illustration|brochure)|city\s+(poster|illustration|map)|landmark|地标|国家\s*海报|country\s+poster/,
      /vintage\s+travel|mid[\s-]?century\s+travel|tourism\s+poster/,
    ],
  },
  {
    key: "infographic",
    patterns: [
      /信息图|infographic|科普\s*(图|海报)|百科|图谱|图鉴|atlas|encyclopedia|时间线|timeline|cheat\s*sheet/,
      /knowledge\s+(map|graph|diagram)|relationship\s+map|isometric\s+(infographic|cutaway|map)/,
      /科学|生物|生命周期|life\s+cycle|workflow|流程图|systems?\s+map/,
    ],
  },
  {
    key: "classical",
    patterns: [
      /(汉|唐|宋|元|明|清|秦|周|商|魏)朝|帝(王|后)|中国\s*古|古风|古装|古典|敦煌|水墨|工笔|长卷|雕花|京剧|戏曲|神话|nezha|哪吒|孙悟空|赤壁|李白|杜甫|苏轼|martial\s+art|kungfu|ancient\s+china|ming\s+dynasty|qing\s+dynasty|chinoiserie/,
    ],
  },
  {
    key: "storyboard",
    patterns: [
      /storyboard|分镜|story\s+board|cinematic\s+(scene|panel|sheet)|comic\s+(panel|grid)|prestige.*thriller|movie\s+poster\s+sheet/,
    ],
  },
  {
    key: "architecture",
    patterns: [
      /(建筑|室内|interior|architectural|建筑外观|户型|空间设计|industrial\s+architecture|skyscraper|cathedral|isometric\s+building)/,
    ],
  },
  // ── broader portrait bucket: photos of one or more real-looking humans
  {
    key: "portrait",
    patterns: [
      /portrait|写真|人像|肖像|self[\s-]?ie|selfie|fashion\s+(portrait|editorial)|street\s+(portrait|fashion)|cinematic\s+portrait|film\s+photography\s+of\s+(a|young|woman|man)/,
      /(beautiful|stylish|young)\s+(woman|girl|man|guy|model)/,
      /胶片(感)?\s+(人像|写真)|韩系\s*(人像|写真)|日系\s*(人像|写真)/,
    ],
  },
  // ── illustration: anything explicitly illustrative (not realism)
  {
    key: "illustration",
    patterns: [
      /watercolor|水彩|水墨\s*画|盐田|纸雕|paper\s*cut|paper[\s-]?craft|童话\s*插画|scrapbook|sketchbook|hand[\s-]?drawn|crayon|pencil\s+illustration|comic\s+illustration|anime\s+(art|style)|插画|illustration|illustrated/,
    ],
  },
  // ── brand & KV: brand identity, logos, multi-touchpoint design
  {
    key: "brand-kv",
    patterns: [
      /brand\s+(identity|guidelines|kv|key\s+visual)|logo\s+design|品牌\s*(KV|主视觉|VI|身份|系统|形象)|品牌触点|visual\s+identity|brand\s+system|套\s*VI/,
      /\bkv\b/,
    ],
  },
  // ── ui screenshot: app/web/dashboard mockups
  {
    key: "ui-screenshot",
    patterns: [
      /screenshot|截图|app\s+(ui|screen|mockup)|dashboard\s+(ui|mockup)|interface\s+design|web(\s+page)?\s+(mockup|design)|ui\s+kit/,
    ],
  },
  // ── poster general: anything still left that mentions poster
  {
    key: "poster-general",
    patterns: [/poster|海报|招贴|campaign\s+(poster|ad)|magazine\s+cover/],
  },
];

const FALLBACK = "other";

const USER_CATEGORY_LABEL = {
  "xhs-cover": "小红书封面",
  "wechat-grid": "朋友圈九宫格",
  "merchant-poster": "商家海报",
  portrait: "人像写真",
  "kids-portrait": "儿童·全家福",
  "3d-ip": "3D · IP 形象",
  ecommerce: "电商产品图",
  "travel-poster": "城市旅行海报",
  "brand-kv": "品牌 KV / Logo",
  festival: "节日营销",
  infographic: "信息图 · 知识海报",
  sticker: "表情包 · 头像",
  "ui-screenshot": "UI 截图",
  "poster-general": "通用海报",
  illustration: "插画与艺术",
  classical: "历史 · 古风",
  storyboard: "场景 · 分镜",
  architecture: "建筑 · 空间",
  other: "其他用例",
};

function classify(c) {
  const text =
    `${c.title || ""} | ${c.category || ""} | ${c.promptPreview || ""} | ${(c.tags || []).join(" ")} | ${(c.styles || []).join(" ")} | ${(c.scenes || []).join(" ")}`.toLowerCase();

  const matches = [];
  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (p.test(text)) {
        matches.push(rule.key);
        break;
      }
    }
  }

  // Dedupe in order, keep up to 3 buckets — first is primary.
  const unique = [];
  for (const k of matches) if (!unique.includes(k)) unique.push(k);

  if (unique.length === 0) {
    // Last-resort hint by ratio: portrait-ish ratios → portrait, square → poster, etc.
    const ratio = (c.ratio || "").trim();
    if (ratio === "9:16") return { primary: "poster-general", secondaries: [] };
    if (ratio === "1:1") return { primary: "ecommerce", secondaries: [] };
    return { primary: FALLBACK, secondaries: [] };
  }

  return { primary: unique[0], secondaries: unique.slice(1, 3) };
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
  if (!out.commercialOk) {
    out.commercialOk = "ask";
    touched = true;
  }
  if (!out.difficulty) {
    out.difficulty = inferDifficulty(out);
    touched = true;
  }
  if (!out.seoTitle || !out.seoDescription || !KEEP_CATS) {
    const seo = buildSeo(out, out.userCategory);
    out.seoTitle = seo.seoTitle;
    out.seoDescription = seo.seoDescription;
    touched = true;
  }
  if (!out.createdAt) {
    out.createdAt = new Date(2025, 0, 1).toISOString();
    touched = true;
  }

  if (touched) touchedCount += 1;
  return out;
});

if (CHECK) {
  const missing = next.filter((c) => !c.slug || !c.userCategory || !c.ratio || !c.seoTitle).length;
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
  process.exit(0);
}

writeFileSync(CASES_PATH, JSON.stringify(next), "utf8");
console.log(
  `✓ migrated ${touchedCount} of ${raw.length} cases (${categoryChanges} re-categorized) → ${CASES_PATH}`,
);
