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
 * Chinese display labels for template "适用方向" tags (the `tags[]` field on
 * data/manual/templates.json). Keys are the lowercased raw token; lookup
 * normalizes the same way so "Brand"/"brand"/"BRAND" all resolve. Falls back
 * to tagLabel (style/scene maps) so shared tokens stay consistent. CI
 * (labels-core.test.mjs) asserts every templates.json tag resolves to a
 * Chinese label — an unmapped tag fails the build instead of shipping
 * English chips.
 */
export const TEMPLATE_TAG_LABELS = {
  "3d": "3D",
  "3d-illusion": "3D 错视",
  ad: "广告",
  advertising: "广告",
  architecture: "建筑",
  avatar: "头像",
  "bas-relief": "浅浮雕",
  blueprint: "蓝图线稿",
  brand: "品牌",
  "brand identity": "品牌视觉",
  "brand kit": "品牌套件",
  campaign: "营销战役",
  cartography: "地图绘制",
  cgi: "CGI 渲染",
  character: "角色",
  cinematic: "电影感",
  collage: "拼贴",
  commerce: "电商",
  commercial: "商业",
  cover: "封面",
  creative: "创意",
  crypto: "加密货币",
  "dark-theme": "深色主题",
  dashboard: "仪表盘",
  diorama: "微缩场景",
  documentary: "纪实",
  editorial: "编辑排版",
  education: "教育",
  encyclopedia: "百科图鉴",
  engraving: "雕版",
  evolution: "演化图",
  fashion: "时尚",
  festival: "节日",
  "film noir": "黑色电影",
  "film-photography": "胶片摄影",
  fintech: "金融科技",
  "floor-plan": "户型图",
  floorplan: "户型图",
  food: "美食",
  football: "足球",
  fortune: "命理",
  grid: "网格排版",
  handdrawn: "手绘",
  hero: "首屏主视觉",
  "high-speed": "高速摄影",
  historical: "历史",
  "id-photo": "证件照",
  illustration: "插画",
  instagram: "Instagram 帖图",
  industrial: "工业",
  infographic: "信息图",
  knowledge: "知识科普",
  kv: "主视觉 KV",
  legacy: "传承",
  "line-art": "线稿",
  literary: "文学",
  livestream: "直播",
  logo: "Logo",
  magazine: "杂志",
  map: "地图",
  masking: "遮罩合成",
  material: "材质",
  minimal: "极简",
  "mixed-media": "综合媒介",
  mockup: "样机",
  monochrome: "单色",
  monument: "纪念碑式",
  mysticism: "神秘主义",
  narrative: "叙事",
  "neo-oriental": "新中式",
  newspaper: "报纸",
  notion: "Notion 风格",
  oriental: "东方风",
  origami: "折纸",
  packaging: "包装",
  palmistry: "掌纹",
  paper: "纸质",
  "paper-cut": "剪纸",
  "paper-craft": "纸艺",
  papercraft: "纸艺",
  photography: "摄影",
  "photo-strip": "拍立得",
  popout: "立体弹出",
  portrait: "人像",
  poster: "海报",
  product: "产品",
  realistic: "写实",
  recipe: "食谱",
  restaurant: "餐饮",
  retro: "复古",
  screenshot: "截图",
  "selective color": "局部上色",
  social: "社交",
  "social media": "社交媒体",
  "social-media": "社交媒体",
  "split-screen": "分屏",
  "split-view": "分屏",
  sports: "运动",
  storyboard: "分镜",
  storytelling: "故事叙事",
  studio: "棚拍",
  "style-transfer": "风格迁移",
  technical: "工程图",
  timeline: "时间线",
  travel: "旅行",
  typography: "字体排版",
  ui: "UI",
  vi: "视觉识别",
  vintage: "古典",
  visualization: "可视化",
  woodcut: "木刻",
  yzk: "复古胶片",
};

export function templateTagLabel(value) {
  const key = String(value).toLowerCase();
  return TEMPLATE_TAG_LABELS[key] ?? tagLabel(value);
}

/**
 * For mixed pools (card chips that show styles + scenes + free tags
 * together), prefer the style mapping first so the same raw token always
 * maps the same way.
 */
export function tagLabel(value) {
  return STYLE_LABELS[value] ?? SCENE_LABELS[value] ?? PLATFORM_LABELS[value] ?? value;
}
