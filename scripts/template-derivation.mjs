export const TARGET_TEMPLATE_COUNT = 36;

const UPSTREAM_SOURCE_LABEL = "YouMind GPT Image 2 Prompts";
const MANUAL_SOURCE_LABEL = "本项目手动模板";
const DERIVED_SOURCE_LABEL = "基于合并案例库自动派生";

const BLUEPRINTS = [
  {
    id: "derived-xhs-cover",
    bucket: "xhs-cover",
    title: "小红书爆款封面",
    category: "海报与排版",
    tags: ["XHS", "Cover", "Social"],
    description: "把标题、主体和高点击信息层组织成小红书封面。",
    useWhen: "用于小红书笔记封面、种草图、合集封面和教程首图。",
    match: (c) => isBucket(c, "xhs-cover") || hasText(c, /小红书|xhs|redbook|封面/),
    focus: "高点击标题、主体识别、封面层级、留白和移动端可读性",
    guardrails: "避免长段正文、错误标题、平台 UI 标识和过多装饰贴纸。",
  },
  {
    id: "derived-merchant-promo-poster",
    bucket: "merchant-poster",
    title: "本地商家促销海报",
    category: "海报与排版",
    tags: ["Poster", "Local", "Promo"],
    description: "把门店活动、套餐卖点和价格信息组织成可投放海报。",
    useWhen: "用于餐饮、美业、教培、门店开业和团购促销。",
    match: (c) =>
      isBucket(c, "merchant-poster") ||
      hasText(c, /餐饮|奶茶|美业|教培|门店|促销|团购|开业|店庆|商家|poster|promo|sale/),
    focus: "门店品类、核心套餐、促销标题、价格露出、线下物料比例",
    guardrails: "控制文字数量，避免无关道具抢占商品或服务主体。",
  },
  {
    id: "derived-ecommerce-detail-page",
    bucket: "ecommerce",
    title: "电商详情页卖点图",
    category: "产品与电商",
    tags: ["Product", "Commerce", "Detail"],
    description: "把产品主图、功能卖点和场景利益点组织成电商视觉。",
    useWhen: "用于淘宝、天猫、京东、独立站主图和详情页模块。",
    match: (c) =>
      isBucket(c, "ecommerce") ||
      hasText(c, /产品与电商|电商|商品|产品|包装|详情页|主图|commerce|\bproduct\b|packaging/),
    focus: "产品主体、包装材质、卖点标签、使用场景和转化信息",
    guardrails: "避免包装文字错乱、卖点过密、道具遮挡核心产品。",
  },
  {
    id: "derived-portrait-photo-series",
    bucket: "portrait",
    title: "人像写真组图",
    category: "摄影与写实",
    tags: ["Portrait", "Photo", "Series"],
    description: "生成身份清晰、光线统一、适合社媒展示的人像写真。",
    useWhen: "用于个人写真、头像、穿搭、街拍和胶片感人像。",
    match: (c) =>
      isBucket(c, "portrait") ||
      hasText(c, /人像|写真|肖像|街拍|胶片|portrait|selfie|fashion|model/),
    focus: "人物身份、机位、光线、妆发、动作、服装和真实皮肤质感",
    guardrails: "避免过度磨皮、假脸、手部畸形和影棚感过强。",
  },
  {
    id: "derived-travel-city-poster",
    bucket: "travel-poster",
    title: "城市旅行招贴",
    category: "海报与排版",
    tags: ["Travel", "City", "Poster"],
    description: "把城市地标、路线氛围和旅行标题组织成视觉海报。",
    useWhen: "用于旅行城市海报、文旅宣传、打卡地图和路线封面。",
    match: (c) =>
      isBucket(c, "travel-poster") ||
      hasText(c, /旅行|旅游|城市|地标|地图|travel|city|landmark|tourism/),
    focus: "城市地标、季节、旅行情绪、标题排版、地图或路线线索",
    guardrails: "避免地标错置、国家城市混淆和廉价旅游传单风。",
  },
  {
    id: "derived-festival-campaign",
    bucket: "festival",
    title: "节日营销主视觉",
    category: "海报与排版",
    tags: ["Festival", "Campaign", "KV"],
    description: "为节日节点生成有销售目标的主视觉和传播图。",
    useWhen: "用于春节、中秋、圣诞、生日、双十一等节点活动。",
    match: (c) =>
      isBucket(c, "festival") ||
      hasText(c, /节日|春节|中秋|圣诞|生日|新年|双十一|festival|holiday|christmas|birthday/),
    focus: "节日符号、品牌商品、活动标题、促销利益和氛围光色",
    guardrails: "避免堆砌符号、错用节日元素和难读的装饰字体。",
  },
  {
    id: "derived-wechat-grid-story",
    bucket: "wechat-grid",
    title: "朋友圈九宫格叙事",
    category: "场景与叙事",
    tags: ["Wechat", "Grid", "Story"],
    description: "把生活记录、活动过程或旅行故事拆成九宫格画面。",
    useWhen: "用于朋友圈九宫格、生活方式记录、品牌活动回顾。",
    match: (c) => isBucket(c, "wechat-grid") || hasText(c, /九宫格|朋友圈|moments/),
    focus: "九张图的顺序、统一色调、每格主体和整体叙事节奏",
    guardrails: "避免每格重复、拼图边距混乱和不可读的小字。",
  },
  {
    id: "derived-sticker-avatar-pack",
    bucket: "sticker",
    title: "头像表情包套装",
    category: "插画与艺术",
    tags: ["Sticker", "Avatar", "Pack"],
    description: "生成统一角色、表情和动作体系的头像或贴纸套装。",
    useWhen: "用于微信表情、头像、社群贴纸、品牌吉祥物表情。",
    match: (c) => isBucket(c, "sticker") || hasText(c, /表情|头像|贴纸|sticker|avatar|emoji/),
    focus: "角色身份、表情列表、动作差异、透明背景和统一描边",
    guardrails: "避免角色前后不一致、表情重复和水印平台标识。",
  },
  {
    id: "derived-kids-family-portrait",
    bucket: "kids-portrait",
    title: "儿童亲子合影",
    category: "摄影与写实",
    tags: ["Kids", "Family", "Portrait"],
    description: "生成自然、温暖、身份稳定的儿童或全家福影像。",
    useWhen: "用于亲子写真、儿童毕业照、节日合影和家庭记录。",
    match: (c) =>
      isBucket(c, "kids-portrait") || hasText(c, /儿童|亲子|全家福|家庭|宝宝|kids|family|baby/),
    focus: "家庭成员关系、儿童表情、服装协调、自然互动和安全姿态",
    guardrails: "避免成人化造型、假笑、脸部相似度丢失和过度精修。",
  },
  {
    id: "derived-3d-ip-mascot",
    bucket: "3d-ip",
    title: "3D IP 吉祥物",
    category: "角色与人物",
    tags: ["3D", "IP", "Mascot"],
    description: "把品牌或人物设定转成可落地的 3D 角色资产。",
    useWhen: "用于潮玩、盲盒、品牌吉祥物、收藏玩具和角色海报。",
    match: (c) =>
      isBucket(c, "3d-ip") || hasText(c, /3d|ip|吉祥物|玩偶|手办|盲盒|潮玩|mascot|toy|figurine/),
    focus: "角色轮廓、材质、表情、道具、比例和商业化展示角度",
    guardrails: "避免塑料廉价感、五官失控、手脚畸形和背景喧宾夺主。",
  },
  {
    id: "derived-game-character-sheet",
    bucket: "game-asset",
    title: "游戏角色设定表",
    category: "角色与人物",
    tags: ["Game", "Character", "Sheet"],
    description: "把角色概念转化为可用的游戏资产：三视图、卡牌或设定表。",
    useWhen: "用于游戏角色设定、抽卡卡牌、机甲设计和像素/JRPG 素材。",
    match: (c) =>
      isBucket(c, "game-asset") ||
      hasText(c, /角色设定|三视图|卡牌|game\s*(asset|character|art)|character\s*(sheet|concept|card)|gacha|mecha|voxel|jrpg|pixel\s*art/),
    focus: "角色身份、三视图角度、装备细节、风格统一性和卡牌 UI 框架",
    guardrails: "避免多角色混搭、角度不一致和 UI 元素遮挡角色主体。",
  },
  {
    id: "derived-brand-kv-system",
    bucket: "brand-kv",
    title: "品牌 KV 延展系统",
    category: "品牌与标志",
    tags: ["Brand", "KV", "Campaign"],
    description: "把品牌主视觉延展到海报、包装、社媒和展示触点。",
    useWhen: "用于品牌 KV、Logo 应用、Campaign 视觉板和物料延展。",
    match: (c) =>
      isBucket(c, "brand-kv") ||
      hasText(c, /品牌|标志|logo|主视觉|\bvi\b|\bbrand\b|\bidentity\b|\bkv\b/),
    focus: "品牌名、核心图形、配色、字体、触点清单和统一版式规则",
    guardrails: "避免多个品牌风格混杂、Logo 错字和触点过多导致失焦。",
  },
  {
    id: "derived-storyboard-sequence",
    bucket: "storyboard",
    title: "电影分镜序列",
    category: "场景与叙事",
    tags: ["Storyboard", "Cinema", "Sequence"],
    description: "把一个动作或剧情拆成镜头清晰的分镜画面。",
    useWhen: "用于电影分镜、广告脚本、短视频镜头规划和漫画叙事。",
    match: (c) =>
      isBucket(c, "storyboard") || hasText(c, /场景与叙事|分镜|镜头|故事板|storyboard|sequence|cinematic/),
    focus: "镜头顺序、景别变化、动作连续性、情绪推进和画幅一致性",
    guardrails: "避免镜头跳跃、角色服装不连续和每格构图雷同。",
  },
  {
    id: "derived-architecture-concept-board",
    bucket: "architecture",
    title: "建筑空间概念板",
    category: "建筑与空间",
    tags: ["Architecture", "Interior", "Board"],
    description: "为建筑、室内或城市空间生成概念表现和材质板。",
    useWhen: "用于室内设计、建筑外观、商业空间、城市规划概念图。",
    match: (c) =>
      isBucket(c, "architecture") || hasText(c, /建筑|空间|室内|城市规划|architecture|interior|space/),
    focus: "空间功能、视角、尺度、材质、自然光和人流使用情境",
    guardrails: "避免透视错误、材质混乱、家具尺度不合理和无入口空间。",
  },
  {
    id: "derived-document-layout-brief",
    title: "文档出版版式",
    category: "文档与出版",
    tags: ["Document", "Publishing", "Layout"],
    description: "把报告、手册、简历或出版物组织成可读的版式系统。",
    useWhen: "用于报告封面、杂志跨页、说明书、简历和资料型长图。",
    match: (c) => isBucket(c, "document-publishing") || hasText(c, /文档|出版|document|publishing|report|magazine|手册|报告|简历/),
    focus: "标题层级、栏目网格、图文比例、页码标识和阅读顺序",
    guardrails: "避免正文过长、字号过小、装饰过多和随机乱码文字。",
  },
];
const BLUEPRINT_IDS = new Set(BLUEPRINTS.map((blueprint) => blueprint.id));

export function enrichUpstreamTemplate(template, sourceUrl) {
  return {
    ...template,
    sourceType: template.sourceType || "upstream-style",
    sourceLabel: template.sourceLabel || UPSTREAM_SOURCE_LABEL,
    sourceUrl: template.sourceUrl || sourceUrl,
  };
}

export function mergeTemplateCollections({
  upstreamTemplates,
  derivedTemplates,
  manualTemplates,
}) {
  const map = new Map();
  for (const template of upstreamTemplates) {
    if (template?.id) map.set(template.id, template);
  }
  for (const template of derivedTemplates) {
    if (template?.id && !map.has(template.id)) map.set(template.id, template);
  }
  for (const template of manualTemplates) {
    if (!template?.id) continue;
    map.set(template.id, {
      ...template,
      sourceType: "manual",
      sourceLabel: template.sourceLabel || MANUAL_SOURCE_LABEL,
    });
  }
  return sortManualTemplatesFirst(Array.from(map.values()));
}

function sortManualTemplatesFirst(templates) {
  return templates
    .map((template, index) => ({
      template,
      index,
      time: validCreatedTime(template.createdAt),
    }))
    .sort((a, b) => {
      const aManual = a.template.sourceType === "manual";
      const bManual = b.template.sourceType === "manual";
      if (aManual !== bManual) return aManual ? -1 : 1;

      if (aManual && bManual) {
        const aHasDate = a.time !== null;
        const bHasDate = b.time !== null;
        if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;
        if (a.time !== null && b.time !== null && a.time !== b.time) {
          return b.time - a.time;
        }
      }

      return a.index - b.index;
    })
    .map(({ template }) => template);
}

function validCreatedTime(value) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function getTemplateDerivationBase(templates) {
  return templates.filter((template) => {
    if (!template?.id) return false;
    if (template.sourceType === "derived-case") return false;
    if (!template.sourceType && template.id.startsWith("derived-")) return false;
    return true;
  });
}

export function deriveTemplatesFromCases(cases, existingTemplates, options = {}) {
  const targetCount = options.targetCount ?? TARGET_TEMPLATE_COUNT;
  const sourceUrl = options.sourceUrl || "";
  const existingIds = new Set(existingTemplates.map((template) => template.id));
  const targetBaseCount = existingTemplates.filter(countsTowardGeneratedTarget).length;
  const remaining = Math.max(0, targetCount - targetBaseCount);
  const derived = [];

  if (remaining === 0) return derived;

  for (const blueprint of BLUEPRINTS) {
    if (derived.length >= remaining) break;
    if (existingIds.has(blueprint.id)) continue;

    const pool = cases.filter((item) => isUsableCase(item) && blueprint.match(item));
    if (pool.length === 0) continue;

    const selected = pickRepresentativeCases(pool, blueprint);
    derived.push(buildDerivedTemplate(blueprint, selected, sourceUrl));
    existingIds.add(blueprint.id);
  }

  return derived;
}

function countsTowardGeneratedTarget(template) {
  if (template?.sourceType !== "manual") return true;
  return !String(template.id || "").startsWith("derived-") || BLUEPRINT_IDS.has(template.id);
}

function buildDerivedTemplate(blueprint, cases, sourceUrl) {
  const primary = cases[0];
  const referenceLines = cases
    .slice(0, 3)
    .map((item) => `- #${item.id} ${item.title}: ${clip(item.promptPreview || item.prompt || "", 96)}`)
    .join("\n");
  const direction = Array.from(
    new Set([
      ...blueprint.tags,
      ...cases.flatMap((item) => [...(item.tags || []), ...(item.styles || []), ...(item.scenes || [])]),
    ]),
  )
    .filter(Boolean)
    .slice(0, 10)
    .join(" / ");

  return {
    id: blueprint.id,
    title: blueprint.title,
    category: blueprint.category,
    tags: blueprint.tags,
    description: blueprint.description,
    cover: primary.imageUrl,
    prompt: [
      `模板：${blueprint.title}`,
      `用途：${blueprint.useWhen}`,
      `视觉方向：${direction}`,
      "",
      "请基于以下结构生成一条可直接用于 GPT Image 2 的图片 Prompt：",
      `- 主体：[明确要生成的主体，并贴合「${blueprint.focus}」]`,
      "- 场景：[使用环境、受众、平台和传播语境]",
      "- 构图：[画面比例、镜头距离、主体位置、层级和留白]",
      "- 风格：[材质、光线、色彩、字体、渲染或摄影语言]",
      "- 约束：[必须出现/不能出现的元素、文字准确性、品牌限制]",
      "",
      "参考案例信号：",
      referenceLines,
      "",
      "使用建议：",
      `- 先锁定 ${blueprint.focus}。`,
      "- 再替换主体、品牌、场景和比例，保持信息层级清楚。",
      "",
      "防坑指南：",
      `- ${blueprint.guardrails}`,
    ].join("\n"),
    useWhen: blueprint.useWhen,
    sourceType: "derived-case",
    sourceLabel: DERIVED_SOURCE_LABEL,
    sourceUrl,
    derivedFrom: cases.map((item) => item.id),
  };
}

function pickRepresentativeCases(cases, blueprint) {
  return [...cases]
    .sort((a, b) => {
      const rankDelta = caseRank(b, blueprint) - caseRank(a, blueprint);
      if (rankDelta !== 0) return rankDelta;
      const aTime = Date.parse(a.createdAt || "");
      const bTime = Date.parse(b.createdAt || "");
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
        return bTime - aTime;
      }
      return Number(b.id) - Number(a.id);
    })
    .slice(0, 5);
}

function caseRank(item, blueprint) {
  if (blueprint.bucket && isBucket(item, blueprint.bucket)) return 3;
  if (item.category && item.category === blueprint.category) return 2;
  return 1;
}

function isUsableCase(item) {
  return Boolean(item?.id && item.imageUrl && (item.promptPreview || item.prompt));
}

function isBucket(item, key) {
  return item.userCategory === key || (item.userCategories || []).includes(key);
}

function hasText(item, pattern) {
  const text = [
    item.title,
    item.category,
    item.promptPreview,
    item.prompt,
    ...(item.tags || []),
    ...(item.styles || []),
    ...(item.scenes || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return pattern.test(text);
}

function clip(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}
