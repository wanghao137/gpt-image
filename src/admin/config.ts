/**
 * Admin runtime configuration.
 *
 * Defaults are baked in at build time so the admin works without
 * additional setup. Override per-deploy via environment variables:
 *
 *   VITE_ADMIN_REPO_OWNER   = wanghao137
 *   VITE_ADMIN_REPO_NAME    = gpt-image
 *   VITE_ADMIN_REPO_BRANCH  = main
 */

import type { RepoTarget } from "./github";

export const REPO_TARGET: RepoTarget = {
  owner: import.meta.env.VITE_ADMIN_REPO_OWNER || "wanghao137",
  repo: import.meta.env.VITE_ADMIN_REPO_NAME || "gpt-image",
  branch: import.meta.env.VITE_ADMIN_REPO_BRANCH || "main",
};

export const PATHS = {
  cases: "data/manual/cases.json",
  templates: "data/manual/templates.json",
  uploadsDir: "public/uploads",
} as const;

/** Curated list of categories — matches the localization map in scripts/sync.mjs. */
export const CATEGORIES = [
  "建筑与空间",
  "品牌与标志",
  "角色与人物",
  "图表与信息图",
  "文档与出版",
  "历史与古典",
  "插画与艺术",
  "其他用例",
  "摄影与写实",
  "海报与排版",
  "产品与电商",
  "场景与叙事",
  "UI 与界面",
] as const;

/** Common style/scene chips — only suggestions, free text is allowed. */
export const COMMON_STYLES = [
  "Realistic",
  "Illustration",
  "3D Render",
  "Poster",
  "Editorial",
  "Cinematic",
  "Minimal",
  "Comic",
  "Watercolor",
  "Cyberpunk",
  "Studio",
  "Documentary",
];

export const COMMON_SCENES = [
  "Tech",
  "Commerce",
  "Brand",
  "Editorial",
  "Lifestyle",
  "Education",
  "Game",
  "Architecture",
  "Portrait",
  "Product",
  "Map",
  "Infographic",
];
