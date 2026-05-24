const DEFAULT_PREVIEW_LENGTH = 220;

const STYLE_RULES = [
  { value: "Poster", pattern: /海报|招贴|封面|poster|cover|campaign/i },
  { value: "Realistic", pattern: /写实|摄影|真实|photo|realistic|camera|lens/i },
  { value: "Illustration", pattern: /插画|绘本|漫画|illustration|anime|comic|watercolor/i },
  { value: "3D Render", pattern: /3d|三维|渲染|手办|玩偶|mascot|toy|render/i },
  { value: "Editorial", pattern: /品牌|杂志|主视觉|kv|editorial|identity|lookbook/i },
  { value: "Cinematic", pattern: /电影|镜头|分镜|cinematic|storyboard|scene/i },
  { value: "Minimal", pattern: /极简|minimal|clean|留白/i },
  { value: "Studio", pattern: /影棚|棚拍|studio|product shot/i },
  { value: "Documentary", pattern: /纪实|街拍|documentary|candid/i },
];

const SCENE_RULES = [
  { value: "Commerce", pattern: /电商|商品|产品|促销|套餐|价格|门店|商家|奶茶|餐饮|sale|promo|commerce|product/i },
  { value: "Social", pattern: /小红书|朋友圈|抖音|社媒|手机端|xhs|wechat|douyin|social|thumbnail/i },
  { value: "Brand", pattern: /品牌|logo|标志|kv|vi|identity|campaign/i },
  { value: "Editorial", pattern: /杂志|封面|排版|editorial|magazine|typography/i },
  { value: "Portrait", pattern: /人像|写真|肖像|人物|portrait|selfie|model/i },
  { value: "Product", pattern: /商品|产品|包装|主图|详情页|product|packaging/i },
  { value: "Education", pattern: /科普|知识|课程|教育|教程|infographic|education|diagram/i },
  { value: "Architecture", pattern: /建筑|空间|室内|城市|architecture|interior|space/i },
  { value: "Infographic", pattern: /信息图|图解|图表|流程|infographic|chart|atlas/i },
  { value: "Tech", pattern: /ui|界面|仪表盘|dashboard|app|software|tech/i },
];

const CATEGORY_HINTS = {
  "建筑与空间": { styles: ["Realistic"], scenes: ["Architecture"] },
  "品牌与标志": { styles: ["Editorial"], scenes: ["Brand"] },
  "角色与人物": { styles: ["Illustration"], scenes: ["Portrait"] },
  "图表与信息图": { styles: ["Minimal"], scenes: ["Infographic", "Education"] },
  "文档与出版": { styles: ["Editorial"], scenes: ["Education"] },
  "历史与古典": { styles: ["Illustration"], scenes: ["Education"] },
  "插画与艺术": { styles: ["Illustration"], scenes: ["Editorial"] },
  "摄影与写实": { styles: ["Realistic"], scenes: ["Portrait"] },
  "海报与排版": { styles: ["Poster"], scenes: ["Social"] },
  "产品与电商": { styles: ["Studio"], scenes: ["Commerce", "Product"] },
  "场景与叙事": { styles: ["Cinematic"], scenes: ["Editorial"] },
  "UI 与界面": { styles: ["Minimal"], scenes: ["Tech"] },
};

const TEMPLATE_TAG_HINTS = {
  "建筑与空间": ["Architecture", "Interior"],
  "品牌与标志": ["Brand", "Identity"],
  "角色与人物": ["Character", "Portrait"],
  "图表与信息图": ["Infographic", "Education"],
  "文档与出版": ["Document", "Layout"],
  "历史与古典": ["Classical", "Culture"],
  "插画与艺术": ["Illustration", "Style"],
  "摄影与写实": ["Photography", "Realistic"],
  "海报与排版": ["Poster", "Typography"],
  "产品与电商": ["Product", "Commerce"],
  "场景与叙事": ["Storyboard", "Scene"],
  "UI 与界面": ["UI", "Dashboard"],
};

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(values, max = Number.POSITIVE_INFINITY) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = normalizeText(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

function textOf(item) {
  return normalizeText(
    [
      item?.title,
      item?.category,
      item?.prompt,
      item?.promptPreview,
      ...(Array.isArray(item?.tags) ? item.tags : []),
      ...(Array.isArray(item?.styles) ? item.styles : []),
      ...(Array.isArray(item?.scenes) ? item.scenes : []),
    ].join(" "),
  );
}

function inferList(item, rules, kind) {
  const haystack = textOf(item);
  const categoryValues = CATEGORY_HINTS[item?.category]?.[kind] || [];
  const ruleValues = rules.filter((rule) => rule.pattern.test(haystack)).map((rule) => rule.value);
  return unique([...categoryValues, ...ruleValues], 6);
}

function shouldWrite(value, overwrite) {
  if (overwrite) return true;
  if (Array.isArray(value)) return value.length === 0;
  return !normalizeText(value);
}

export function makePromptPreview(prompt, maxLength = DEFAULT_PREVIEW_LENGTH) {
  const text = normalizeText(prompt);
  if (text.length <= maxLength) return text;
  if (maxLength <= 1) return "…";
  return `${text.slice(0, maxLength - 1)}…`;
}

export function inferCaseFields(caseItem, options = {}) {
  const overwrite = options.overwrite ?? true;
  const next = { ...caseItem };
  const inferredStyles = inferList(caseItem, STYLE_RULES, "styles");
  const inferredScenes = inferList(caseItem, SCENE_RULES, "scenes");
  const inferredTags = unique([...inferredStyles, ...inferredScenes], 6);

  if (shouldWrite(next.promptPreview, overwrite)) {
    next.promptPreview = makePromptPreview(next.prompt);
  }
  if (shouldWrite(next.imageAlt, overwrite)) {
    next.imageAlt = normalizeText(next.title) || `案例 ${normalizeText(next.id) || ""}`.trim();
  }
  if (shouldWrite(next.styles, overwrite)) {
    next.styles = inferredStyles;
  }
  if (shouldWrite(next.scenes, overwrite)) {
    next.scenes = inferredScenes;
  }
  if (shouldWrite(next.tags, overwrite)) {
    next.tags = inferredTags;
  }

  return next;
}

export function inferTemplateFields(template, options = {}) {
  const overwrite = options.overwrite ?? true;
  const next = { ...template };
  const title = normalizeText(next.title) || normalizeText(next.id) || "未命名";
  const category = normalizeText(next.category) || "其他用例";
  const tags = unique([...(TEMPLATE_TAG_HINTS[category] || []), ...(next.tags || [])], 6);

  if (shouldWrite(next.tags, overwrite)) {
    next.tags = tags;
  }
  if (shouldWrite(next.description, overwrite)) {
    next.description = `用于${category}的${title}模板。`;
  }
  if (shouldWrite(next.useWhen, overwrite)) {
    next.useWhen = `适合需要快速复用「${title}」结构的内容生产场景。`;
  }

  return next;
}
