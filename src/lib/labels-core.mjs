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
