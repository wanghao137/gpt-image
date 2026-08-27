/**
 * Hot-search chips on /cases. Each entry maps its Chinese label to the
 * user-intent category bucket it actually means — clicking a chip applies
 * that category filter. The old behavior set the label as a literal text
 * query ("小红书封面" matched almost nothing because the phrase appears in
 * almost no title/prompt), which made the chips feel broken.
 */
export const HOT_CASE_SEARCHES = [
  // "产品海报" is buyer language for product/e-commerce key visuals — the
  // 电商产品图 bucket (955+ cases), not 海报与排版 (misc poster layouts).
  { label: "产品海报", category: "ecommerce" },
  { label: "小红书封面", category: "xhs-cover" },
  { label: "信息图", category: "infographic" },
  { label: "品牌 Logo", category: "brand-kv" },
  { label: "人像写真", category: "portrait" },
  { label: "UI 界面", category: "ui-screenshot" },
];
