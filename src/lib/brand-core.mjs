export const BRAND = {
  name: "桃子AI视觉实验室",
  shortName: "桃子AI",
  // 当前生图模型的对外展示名。升级换代只改这一处，页面文案统一引用。
  model: "GPT-Image 2.5",
  latinName: "GPT-IMAGE 2.5 PROMPT LAB",
  productName: "GPT-Image 2.5 案例与 Prompt 模板库",
  siteTitle: "桃子AI视觉实验室 - GPT-Image 2.5 案例与 Prompt 模板库",
  adminTitle: "桃子AI视觉实验室 · 管理后台",
  adminShortTitle: "管理后台",
  faviconVersion: "taostudio-peach-raster-20260522",
  siteUrl: "https://taostudioai.com",
  description:
    "桃子AI视觉实验室整理小红书封面、商家海报、人像写真、信息图等 GPT-Image 2.5 真实案例与 Prompt 模板，按场景分类，一键复制就能出图。",
  fallbackDescription:
    "小红书封面、商家海报、人像写真、信息图，450+ 个 GPT-Image 2.5 真实案例与 Prompt 模板，按场景分类，一键复制就能出图。",
  keywords:
    "桃子AI视觉实验室, GPT-Image 2.5, GPT-Image 2, GPT-Image 提示词, AI 图片提示词, 小红书封面, 商家海报, 人像写真, AI 海报, Prompt 模板",
  sourceCredit: "YouMind GPT Image 2 Prompts",
};

export function formatSiteTitle(title) {
  const value = typeof title === "string" ? title.trim() : "";
  if (!value || value === BRAND.name || value === BRAND.siteTitle) {
    return BRAND.siteTitle;
  }
  if (value.includes(BRAND.name)) return value;
  return `${value} | ${BRAND.name}`;
}
