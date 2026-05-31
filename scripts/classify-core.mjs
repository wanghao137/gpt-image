/**
 * User-intent category classifier — single source of truth.
 *
 * WHY THIS EXISTS
 *   The previous classifier (in migrate-v2.mjs) used "first regex that matches
 *   the flattened text wins, rule order = priority". That produced absurd
 *   buckets because a single incidental word hijacked the result:
 *     - a *scrapbook poster* whose prompt body mentions "贴纸" (sticker) →
 *       classified as `sticker` (表情包·头像)
 *     - a *portrait* shot "室内" (indoors) → classified as `architecture`
 *     - a *写真* (photo portrait) that happens to contain "长卷" → `classical`
 *   Those buckets drive /category pages, homepage tiles, related cases and the
 *   SEO landing pages, so a wrong bucket is a wrong landing page.
 *
 * HOW THIS WORKS
 *   Instead of first-match, every category accumulates a SCORE. A signal's
 *   contribution = (signal strength) × (field weight). The field a keyword
 *   appears in matters: a keyword in the human-written `title` is far more
 *   telling than the same keyword buried in a long `promptPreview`.
 *
 *   Two refinements fix the bulk of the old errors:
 *     1. GENERIC STOCK TITLES — much of the upstream data has auto-generated
 *        titles echoed from the coarse category ("建筑空间场景图",
 *        "写实摄影风格创作"). Those titles routinely contradict the actual
 *        prompt (e.g. a cosplay portrait titled "建筑空间场景图"). When the
 *        title is one of these stock strings we skip scoring it, so the real
 *        content (promptPreview + tags) decides the bucket.
 *     2. FIELD WEIGHTING — promptPreview carries real weight (it's the actual
 *        content) but a single ambient keyword can't outvote a defining one in
 *        the title or tags.
 *
 *   Framework-free `.mjs` so migrate-v2.mjs imports it AND node:test can unit
 *   test it without a build step (see classify-core.test.mjs).
 */

/** All user-intent buckets + their human labels (UI labels live in src/lib/userCategories.ts). */
export const USER_CATEGORY_LABEL = {
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

export const FALLBACK_CATEGORY = "other";

/**
 * Field weights. The actual content (promptPreview) and the human title are
 * authoritative; the coarse upstream `category` is supporting evidence; the
 * `tags`/`styles`/`scenes` arrays are AUTO-DERIVED, overlapping and noisy (the
 * same concept is echoed across all three), so they each get a low weight to
 * keep them from out-voting the real content — e.g. a cafe promo poster tagged
 * "Illustration" should still classify as a merchant poster by its subject.
 */
const FIELD_WEIGHTS = {
  title: 3,
  category: 2,
  tags: 1,
  styles: 1,
  scenes: 1,
  promptPreview: 3,
};

/**
 * Priority order used ONLY to break score ties. Niche/high-intent buckets come
 * first so that, all else equal, "merchant-poster" beats the catch-all
 * "poster-general", and "portrait" beats the ambient "architecture".
 */
const PRIORITY = [
  "kids-portrait",
  "wechat-grid",
  "festival",
  "3d-ip",
  "xhs-cover",
  "sticker",
  "merchant-poster",
  "ecommerce",
  "travel-poster",
  "infographic",
  "classical",
  "storyboard",
  "brand-kv",
  "ui-screenshot",
  "portrait",
  "illustration",
  "architecture",
  "poster-general",
  "other",
];

/** Signal strengths. */
const STRONG = 3;
const MEDIUM = 2;
const WEAK = 1;

/**
 * Category tiers. A case's *intent* (what it's for) should beat its *style*
 * (how it's drawn), which should beat a generic *format* fallback. Without
 * this, a restaurant promo rendered "scrapbook style" scores on both
 * merchant-poster (intent) and illustration (style); the tier multiplier makes
 * intent win unless the style/format evidence is overwhelmingly stronger.
 *
 *   intent  — what the user actually wants to make (a shop poster, a product
 *             shot, a portrait, an infographic…)
 *   style   — a rendering language that cuts across intents (illustration,
 *             classical, 3d-ip, architecture-as-aesthetic)
 *   format  — last-resort shape buckets (poster-general, other)
 */
const TIER_MULTIPLIER = {
  intent: 1.4,
  style: 1.0,
  format: 0.7,
};
const CATEGORY_TIER = {
  "kids-portrait": "intent",
  "wechat-grid": "intent",
  festival: "intent",
  "xhs-cover": "intent",
  sticker: "intent",
  "merchant-poster": "intent",
  ecommerce: "intent",
  "travel-poster": "intent",
  infographic: "intent",
  "ui-screenshot": "intent",
  "brand-kv": "intent",
  portrait: "intent",
  storyboard: "intent",
  "3d-ip": "style",
  classical: "style",
  illustration: "style",
  architecture: "style",
  "poster-general": "format",
  other: "format",
};

/**
 * Per-category signals: [regex, strength]. Regexes are matched case-insensitively
 * against each field's text. A signal counts at most once per field.
 */
const SIGNALS = {
  "kids-portrait": [
    [/儿童|宝宝|亲子|親子|全家福|幼儿|小孩|母婴/, STRONG],
    [/\bkids?\b|\bbaby\b|infant|toddler|kindergarten|family\s+photo/, STRONG],
    [/学生.*(毕业|合影)|毕业照/, MEDIUM],
  ],
  "wechat-grid": [
    [/朋友圈|九宫格/, STRONG],
    [/wechat\s+moments|moments\s+grid|3\s*x\s*3\s+grid/, STRONG],
  ],
  festival: [
    [/春节|新年|中秋|端午|圣诞|国庆|劳动节|元宵|除夕|节日营销/, STRONG],
    [/chinese\s+new\s+year|\bcny\b|christmas|halloween|valentine|spring\s+festival/, STRONG],
    [/双十一|双11|双12|双[一二]+|生日贺卡|birthday\s+card|holiday\s+(poster|campaign)/, MEDIUM],
  ],
  "3d-ip": [
    [/手办|盲盒|潮玩|玩偶|公仔|可动人偶/, STRONG],
    [/3d\s*(ip|character|toy|figure|figurine|mascot)|figurine|blind\s*box|\bchibi\b|q\s*版/, STRONG],
    [/pixar\s+style|cute\s+3d\s+character|收藏\s*玩具/, MEDIUM],
  ],
  "xhs-cover": [
    [/小红书|小红薯|xiaohongshu|\bxhs\b|redbook|red\s*book|rednote/, STRONG],
  ],
  sticker: [
    [/表情包|微信表情|line\s+sticker|emoji\s*(pack|sheet|set)|sticker\s*(pack|sheet|set)/, STRONG],
    [/头像|avatar|\bpfp\b|profile\s+picture/, STRONG],
    [/贴纸|\bemoji\b|\bsticker\b/, WEAK],
  ],
  "merchant-poster": [
    [/餐饮|奶茶|饮品|咖啡馆|咖啡店|烧烤|火锅|外卖|美食|甜品|烘焙|餐厅|菜单/, STRONG],
    [/coffee\s+shop|restaurant|cafe|menu(?!\s*bar)|bakery|food\s+(poster|stall)/, STRONG],
    [/美业|美容|美甲|理发|美发|spa|nail\s+salon|hair\s+salon|skincare\s+(shop|store)/, STRONG],
    [/促销|大促|甩卖|限时|团购|清仓|开业|店庆|周年庆|招生|公开课|培训\s*海报|课程\s*海报/, STRONG],
    [/商家|店铺|门店|线下\s*海报|印刷品|billboard|shop\s+window|promo(tion)?\s+(poster|banner)|discount\s+poster|sale\s+poster/, MEDIUM],
  ],
  ecommerce: [
    [/电商|淘宝|天猫|京东|拼多多|主图|详情页|带货|种草/, STRONG],
    [/amazon|shopee|lazada|product\s+(listing|page|shot|hero|mockup|photography|packaging)/, STRONG],
    [/包装设计|包装盒|产品包装|商品展示|产品展示|product\s+display/, STRONG],
    [/护肤(产品|宣传)|skincare\s+ad|beauty\s+(ad|product)|beverage\s+ad|\bfmcg\b|\bcpg\b/, MEDIUM],
    [/商品|产品图|\bproduct\b/, WEAK],
  ],
  "travel-poster": [
    [/旅行|旅游|城市\s*(海报|插画|地图)|地标|景点/, STRONG],
    [/travel\s+(poster|illustration|brochure)|city\s+(poster|illustration|map)|landmark|tourism\s+poster/, STRONG],
    [/vintage\s+travel|mid[\s-]?century\s+travel|国家\s*海报|country\s+poster/, MEDIUM],
  ],
  infographic: [
    [/信息图|科普|百科|图鉴|图谱|时间线|流程图|可视化|知识\s*(图|海报|卡)/, STRONG],
    [/infographic|atlas|encyclopedia|timeline|cheat\s*sheet|knowledge\s+(map|graph|diagram)|systems?\s+map/, STRONG],
    [/生命周期|life\s+cycle|workflow|isometric\s+(infographic|cutaway)|exploded\s+view|relationship\s+map/, MEDIUM],
    [/\bdiagram\b|\bchart\b/, WEAK],
  ],
  classical: [
    [/古风|古装|古典|国潮|水墨|工笔|敦煌|京剧|戏曲|长卷|雕花/, STRONG],
    [/(汉|唐|宋|元|明|清|秦|周|商|魏)朝|帝(王|后)|哪吒|孙悟空|赤壁|李白|杜甫|苏轼/, STRONG],
    [/ancient\s+china|ming\s+dynasty|qing\s+dynasty|tang\s+dynasty|chinoiserie|chinese\s+mythology|\bnezha\b/, STRONG],
    [/martial\s+art|kungfu|国风/, MEDIUM],
  ],
  storyboard: [
    [/分镜|连环画|多格漫画|故事板/, STRONG],
    [/storyboard|story\s+board|comic\s+(panel|grid)|cinematic\s+(scene|panel|sheet)|movie\s+poster\s+sheet/, STRONG],
  ],
  architecture: [
    [/建筑外观|户型|空间设计|室内设计|建筑设计|楼宇/, STRONG],
    [/architectural\s+(design|rendering|visualization)|skyscraper|cathedral|interior\s+design|isometric\s+building|floor\s+plan/, STRONG],
    [/建筑|architecture/, MEDIUM],
    [/室内|interior/, WEAK],
  ],
  portrait: [
    [/人像|写真|肖像|自拍|证件照|半身像|大头照/, STRONG],
    [/\bportrait\b|self[\s-]?ie|selfie|cosplay|headshot/, STRONG],
    [/fashion\s+(portrait|editorial)|street\s+(portrait|fashion)|cinematic\s+portrait/, STRONG],
    [/胶片(感)?\s*(人像|写真)|韩系\s*(人像|写真)|日系\s*(人像|写真)/, STRONG],
    [/(young|beautiful|stylish|handsome)\s+(asian\s+|east\s+asian\s+|japanese\s+|korean\s+|chinese\s+)?(woman|girl|man|guy|model|lady|boy)/, STRONG],
    [/少女|少年|女孩|男孩|女子|男子|女偶像|回眸|侧颜|素颜|模特/, MEDIUM],
    [/(japanese|korean|chinese|asian|east\s+asian)\s+(woman|girl|man|boy|lady|idol)/, MEDIUM],
    [/candid\s+(photo|shot|moment)|film\s+photograph|amateur\s+flash\s+photograph|flash\s+photo/, MEDIUM],
  ],
  illustration: [
    [/插画|绘本|童话|手绘|水彩|剪贴簿|拼贴|纸雕|盐田/, STRONG],
    [/illustration|illustrated|watercolor|scrapbook|sketchbook|hand[\s-]?drawn|crayon|paper[\s-]?(cut|craft)|gouache/, STRONG],
    [/anime\s+(art|style|illustration)|comic\s+illustration|flat\s+(vector\s+)?illustration|漫画风|矢量插画/, MEDIUM],
  ],
  "brand-kv": [
    [/品牌\s*(kv|主视觉|vi|身份|系统|形象|识别|概念|手册|提案)|主视觉|视觉识别|品牌触点|套\s*vi|品牌与标志/, STRONG],
    [/brand\s+(identity|guidelines|kv|key\s+visual|system|concept|deck)|logo\s+(design|materialization)|visual\s+identity/, STRONG],
    [/演示封面|提案封面|品牌\s*slides|presentation\s+(cover|deck)|品牌\s*logo/, MEDIUM],
    [/\blogo\b|\bkv\b/, WEAK],
  ],
  "ui-screenshot": [
    [/界面设计|交互设计|仪表盘|网页设计|样机|手机截图|系统状态栏|聊天界面|app\s*界面/, STRONG],
    [/screenshot|dashboard|interface\s+(design|mockup)|app\s+(ui|screen|mockup)|web(\s+page)?\s+(mockup|design)|ui\s+(kit|mockup)|livestream\s+ui|live\s+stream\s+ui/, STRONG],
    [/mobile\s+(app|ui)|landing\s+page|wireframe|figma/, MEDIUM],
  ],
  "poster-general": [
    [/海报|招贴|主视觉海报/, MEDIUM],
    [/\bposter\b|campaign\s+(poster|ad)|magazine\s+cover|key\s+visual/, MEDIUM],
  ],
};

/**
 * Stock titles auto-generated upstream from the coarse category. They are NOT
 * descriptive of the actual image (a cosplay portrait can carry the title
 * "建筑空间场景图"), so when the title matches one of these we don't let it
 * vote — the prompt content + tags decide instead.
 */
const GENERIC_TITLE_RE =
  /^(信息图可视化设计|主题海报版式设计|插画艺术(风格)?创作图?|插画艺术风格创作|建筑空间场景图|室内空间渲染图|人像写实摄影图?|人像写实摄影|写实摄影风格(创作|图)|界面交互设计图|直播界面设计图|综合应用场景图|漫画分镜叙事设计|电商商品展示设计|人物角色设定图|品牌徽标设计图|科普百科图|古风历史题材图|应用界面样机图|界面交互设计图?)$/;

function fieldText(value) {
  if (Array.isArray(value)) return value.join(" ");
  return String(value ?? "");
}

function isGenericTitle(title) {
  return GENERIC_TITLE_RE.test(String(title ?? "").trim());
}

/**
 * Score every category for a case-like object and return a sorted breakdown.
 * Exposed for tests / debugging.
 */
export function scoreCase(caseLike) {
  const titleIsGeneric = isGenericTitle(caseLike?.title);
  const fields = {
    // A generic stock title carries no real signal — drop it to category weight 0.
    title: titleIsGeneric ? "" : fieldText(caseLike?.title).toLowerCase(),
    category: fieldText(caseLike?.category).toLowerCase(),
    tags: fieldText(caseLike?.tags).toLowerCase(),
    styles: fieldText(caseLike?.styles).toLowerCase(),
    scenes: fieldText(caseLike?.scenes).toLowerCase(),
    promptPreview: fieldText(caseLike?.promptPreview).toLowerCase(),
  };

  const scores = {};
  for (const [key, signals] of Object.entries(SIGNALS)) {
    let total = 0;
    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      const text = fields[field];
      if (!text) continue;
      for (const [re, strength] of signals) {
        if (re.test(text)) total += strength * weight;
      }
    }
    if (total > 0) {
      const tier = CATEGORY_TIER[key] ?? "style";
      scores[key] = total * TIER_MULTIPLIER[tier];
    }
  }

  return Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return PRIORITY.indexOf(a[0]) - PRIORITY.indexOf(b[0]);
  });
}

/**
 * Classify a case into a primary bucket + up to two secondaries.
 *
 *   { primary: UserCategoryKey, secondaries: UserCategoryKey[] }
 *
 * Falls back to a ratio-based guess, then "other", when nothing scores.
 */
export function classifyCase(caseLike) {
  const ranked = scoreCase(caseLike);

  if (ranked.length === 0) {
    const ratio = String(caseLike?.ratio ?? "").trim();
    if (ratio === "1:1") return { primary: "ecommerce", secondaries: [] };
    if (ratio === "9:16" || ratio === "3:4") return { primary: "poster-general", secondaries: [] };
    if (ratio === "16:9") return { primary: "architecture", secondaries: [] };
    return { primary: FALLBACK_CATEGORY, secondaries: [] };
  }

  const primary = ranked[0][0];
  const topScore = ranked[0][1];
  // Secondaries: meaningfully-scoring runners-up (>= 40% of the top score),
  // so we don't surface a category a case only grazes.
  const secondaries = ranked
    .slice(1)
    .filter(([, score]) => score >= topScore * 0.4)
    .slice(0, 2)
    .map(([key]) => key);

  return { primary, secondaries };
}
