/**
 * Display labels for style / scene tags.
 *
 * Data shape stays English (so the daily upstream sync, the manual JSON, and
 * the agent skill all stay portable), but the UI shows Chinese. Anything not
 * in the map falls back to the raw value, so adding a new niche tag through
 * the admin doesn't require a code change to render.
 */

const STYLE_LABELS: Record<string, string> = {
  Realistic: "写实",
  Illustration: "插画",
  "3D Render": "3D 渲染",
  "3D": "3D",
  Poster: "海报",
  Editorial: "编辑",
  Cinematic: "电影感",
  Minimal: "极简",
  Comic: "漫画",
  Watercolor: "水彩",
  Cyberpunk: "赛博朋克",
  Studio: "棚拍",
  Documentary: "纪实",
  UI: "UI",
  Product: "产品",
  Brand: "品牌",
  Character: "角色",
  Characters: "角色",
  Infographic: "信息图",
  Architecture: "建筑",
  Classical: "古典",
  Creative: "创意",
};

const SCENE_LABELS: Record<string, string> = {
  Tech: "科技",
  Commerce: "商业",
  Brand: "品牌",
  Editorial: "编辑",
  Lifestyle: "生活",
  Education: "教育",
  Game: "游戏",
  Architecture: "建筑",
  Portrait: "人像",
  Product: "产品",
  Map: "地图",
  Infographic: "信息图",
  Social: "社交",
  Story: "叙事",
  Food: "美食",
  Fashion: "时尚",
  Travel: "旅行",
  History: "历史",
  Creative: "创意",
};

export function styleLabel(value: string): string {
  return STYLE_LABELS[value] ?? value;
}

export function sceneLabel(value: string): string {
  return SCENE_LABELS[value] ?? value;
}

/**
 * For mixed pools (e.g. card chips / modal chips that show styles + scenes
 * together), prefer the style mapping first to keep UI consistent — the same
 * raw token like "Brand" maps the same way regardless of which list it came
 * from.
 */
export function tagLabel(value: string): string {
  return STYLE_LABELS[value] ?? SCENE_LABELS[value] ?? value;
}
