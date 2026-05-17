import type { UserCategoryKey } from "../types";

/**
 * 12+6 buckets of user *intent* (not creator workflow).
 *
 * `pinnedHomepage` controls which 12 tiles surface on the home Showcase grid
 * — the rest are still browsable at /category/:slug but don't get the prime
 * real-estate above the gallery.
 */
export interface UserCategoryMeta {
  key: UserCategoryKey;
  /** Slug used in routes like /category/xhs-cover. */
  slug: string;
  /** Chinese display label. */
  label: string;
  /** Short value prop shown next to the label on tiles & detail headers. */
  tagline: string;
  /** Default ratio hint for empty states / SEO defaults. */
  defaultRatio: string;
  /** Whether the homepage Showcase grid promotes it. */
  pinnedHomepage: boolean;
}

export const USER_CATEGORIES: UserCategoryMeta[] = [
  {
    key: "xhs-cover",
    slug: "xhs-cover",
    label: "小红书封面",
    tagline: "9:16 高点击封面，文字与构图直接可用",
    defaultRatio: "9:16",
    pinnedHomepage: true,
  },
  {
    key: "merchant-poster",
    slug: "merchant-poster",
    label: "商家海报",
    tagline: "餐饮、美业、教培促销与节日宣传",
    defaultRatio: "9:16",
    pinnedHomepage: true,
  },
  {
    key: "portrait",
    slug: "portrait",
    label: "人像写真",
    tagline: "韩系、胶片、写实人像，可加垫图保持身份",
    defaultRatio: "4:5",
    pinnedHomepage: true,
  },
  {
    key: "kids-portrait",
    slug: "kids-portrait",
    label: "儿童 · 全家福",
    tagline: "亲子写真、毕业照、节日合家福",
    defaultRatio: "4:5",
    pinnedHomepage: true,
  },
  {
    key: "3d-ip",
    slug: "3d-ip",
    label: "3D · IP 形象",
    tagline: "潮玩盲盒、品牌吉祥物、Pixar 风角色",
    defaultRatio: "1:1",
    pinnedHomepage: true,
  },
  {
    key: "ecommerce",
    slug: "ecommerce",
    label: "电商产品图",
    tagline: "主图、详情页、包装与场景视觉",
    defaultRatio: "1:1",
    pinnedHomepage: true,
  },
  {
    key: "travel-poster",
    slug: "travel-poster",
    label: "城市旅行海报",
    tagline: "城市地标、复古旅游招贴、文字海报",
    defaultRatio: "9:16",
    pinnedHomepage: true,
  },
  {
    key: "brand-kv",
    slug: "brand-kv",
    label: "品牌 KV / Logo",
    tagline: "品牌主视觉、Logo、VI 应用触点",
    defaultRatio: "16:9",
    pinnedHomepage: true,
  },
  {
    key: "festival",
    slug: "festival",
    label: "节日营销",
    tagline: "春节、中秋、圣诞、双十一节点海报",
    defaultRatio: "9:16",
    pinnedHomepage: true,
  },
  {
    key: "infographic",
    slug: "infographic",
    label: "信息图 · 知识海报",
    tagline: "百科图鉴、流程图、科普长图",
    defaultRatio: "3:4",
    pinnedHomepage: true,
  },
  {
    key: "sticker",
    slug: "sticker",
    label: "表情包 · 头像",
    tagline: "微信表情、贴纸、社交媒体头像",
    defaultRatio: "1:1",
    pinnedHomepage: true,
  },
  {
    key: "wechat-grid",
    slug: "wechat-grid",
    label: "朋友圈九宫格",
    tagline: "九宫格、生活记录、节日朋友圈",
    defaultRatio: "1:1",
    pinnedHomepage: true,
  },

  // ── secondary buckets (browsable but not on homepage) ──
  {
    key: "ui-screenshot",
    slug: "ui-screenshot",
    label: "UI 截图",
    tagline: "App、网页、仪表盘高保真截图",
    defaultRatio: "16:9",
    pinnedHomepage: false,
  },
  {
    key: "poster-general",
    slug: "poster-general",
    label: "通用海报",
    tagline: "活动、电影、艺术展通用海报",
    defaultRatio: "9:16",
    pinnedHomepage: false,
  },
  {
    key: "illustration",
    slug: "illustration",
    label: "插画与艺术",
    tagline: "水彩、水墨、纸艺、漫画风插画",
    defaultRatio: "4:5",
    pinnedHomepage: false,
  },
  {
    key: "classical",
    slug: "classical",
    label: "历史 · 古风",
    tagline: "朝代服饰、长卷叙事、东方神话",
    defaultRatio: "4:5",
    pinnedHomepage: false,
  },
  {
    key: "storyboard",
    slug: "storyboard",
    label: "场景 · 分镜",
    tagline: "电影分镜、世界观叙事、流程板",
    defaultRatio: "16:9",
    pinnedHomepage: false,
  },
  {
    key: "architecture",
    slug: "architecture",
    label: "建筑 · 空间",
    tagline: "室内、建筑外观、城市空间",
    defaultRatio: "16:9",
    pinnedHomepage: false,
  },
  {
    key: "other",
    slug: "other",
    label: "其他用例",
    tagline: "实验性、跨界、特殊任务",
    defaultRatio: "4:5",
    pinnedHomepage: false,
  },
];

const KEY_INDEX = new Map(USER_CATEGORIES.map((c) => [c.key, c]));
const SLUG_INDEX = new Map(USER_CATEGORIES.map((c) => [c.slug, c]));

export function getUserCategoryByKey(key: string): UserCategoryMeta | undefined {
  return KEY_INDEX.get(key as UserCategoryKey);
}
export function getUserCategoryBySlug(slug: string): UserCategoryMeta | undefined {
  return SLUG_INDEX.get(slug);
}
export function userCategoryLabel(key: string): string {
  return KEY_INDEX.get(key as UserCategoryKey)?.label ?? key;
}
export const HOMEPAGE_USER_CATEGORIES = USER_CATEGORIES.filter((c) => c.pinnedHomepage);

/** Platform display labels. */
export const PLATFORM_LABEL: Record<string, string> = {
  xiaohongshu: "小红书",
  wechat: "微信 · 朋友圈",
  douyin: "抖音 · 短视频",
  ec: "电商详情",
  offline: "线下印刷",
};

export function platformLabel(p: string): string {
  return PLATFORM_LABEL[p] ?? p;
}
