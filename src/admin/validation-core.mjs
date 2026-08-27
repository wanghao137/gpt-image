/**
 * Shared write-path validation for ALL manual content entry points.
 *
 * The same rules must hold no matter who writes `data/manual/*.json`:
 *   - the browser admin form editors,
 *   - the raw JSON editor,
 *   - the Hermes server API (api/hermes/content.js),
 *   - and the CI suite that regenerates public/data.
 * Before this core existed, vocabulary rules lived only in a CI test that ran
 * AFTER a commit landed on main — a bad style token (e.g. "Oil Painting" on
 * 2026-08-26) committed fine, then silently blocked `public/data` regeneration
 * and left the content invisible on the live site for days.
 *
 * Vocabulary contract (kept in sync with labels-core.test.mjs):
 *   - a style token is valid when, after tag normalization, it either maps to
 *     a Chinese label in STYLE_LABELS or is a token the pipeline deliberately
 *     drops from the styles axis (REMOVE_FROM_STYLES) — i.e. the SHIPPED
 *     value always renders Chinese.
 *   - scenes follow the same rule against SCENE_LABELS / REMOVE_FROM_SCENES.
 *   - template tags must resolve through templateTagLabel (TEMPLATE_TAG_LABELS
 *     first, then style/scene/platform maps) or be identity-allowlisted.
 *
 * Extending the vocabulary is a deliberate maintainer action: add the mapping
 * in src/lib/labels-core.mjs in the same change, or reuse an existing token.
 */

import {
  IDENTITY_OK_LABELS,
  SCENE_LABELS,
  STYLE_LABELS,
  templateTagLabel,
} from "../lib/labels-core.mjs";
import {
  REMOVE_FROM_SCENES,
  REMOVE_FROM_STYLES,
  normalizeTagToken,
} from "../../scripts/tag-normalize-core.mjs";

/** The 13 fixed site categories (single source for admin UI + Hermes API). */
export const CASE_CATEGORIES = [
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
];

const CASE_CATEGORY_SET = new Set(CASE_CATEGORIES);

const TEMPLATE_SOURCE_TYPES = new Set(["upstream-style", "derived-case", "manual"]);

// GitHub blob HTML pages are not images — a classic copy-paste mistake the
// skill file explicitly forbids.
const GITHUB_BLOB_IMAGE = /github\.com\/[^/]+\/[^/]+\/blob\//i;

export { GITHUB_BLOB_IMAGE };

export function isKnownStyleToken(token) {
  const value = normalizeTagToken(token);
  if (!value) return false;
  return (
    Boolean(STYLE_LABELS[value]) ||
    IDENTITY_OK_LABELS.has(value) ||
    REMOVE_FROM_STYLES.has(value)
  );
}

export function isKnownSceneToken(token) {
  const value = normalizeTagToken(token);
  if (!value) return false;
  return Boolean(SCENE_LABELS[value]) || REMOVE_FROM_SCENES.has(value);
}

export function isKnownTemplateTag(token) {
  const value = String(token ?? "").trim();
  if (!value) return false;
  return templateTagLabel(value) !== value || IDENTITY_OK_LABELS.has(value.toUpperCase());
}

export function isKnownCategory(category) {
  return CASE_CATEGORY_SET.has(String(category ?? "").trim());
}

/** True when the URL is a GitHub blob HTML page (not a direct image link). */
export function isGitHubBlobImage(url) {
  return GITHUB_BLOB_IMAGE.test(String(url ?? ""));
}

export function styleVocabHint() {
  return `在 src/lib/labels-core.mjs 的 STYLE_LABELS 补映射（如 "New Style": "新风格"）后随代码一起提交，或改用现有词表值`;
}

export function sceneVocabHint() {
  return `在 src/lib/labels-core.mjs 的 SCENE_LABELS 补映射后随代码一起提交，或改用现有词表值`;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toList(value) {
  return Array.isArray(value) ? value : [];
}

function issue(issues, index, field, message) {
  issues.push({ index, field, message });
}

/**
 * Validate data/manual/cases.json entries.
 * Hidden entries ({ id, hidden: true }) only require a non-empty id.
 */
export function validateManualCases(cases) {
  const issues = [];
  const seen = new Map();
  toList(cases).forEach((item, index) => {
    const id = text(item?.id);
    const label = id ? `#${id}` : `第 ${index + 1} 条`;
    if (!id) {
      issue(issues, index, "id", `第 ${index + 1} 条缺少 id`);
    } else if (seen.has(id)) {
      issue(issues, index, "id", `#${id} ID 重复（第 ${seen.get(id) + 1}、${index + 1} 条）`);
    } else {
      seen.set(id, index);
    }
    if (item?.hidden === true) return;

    if (!text(item?.title)) issue(issues, index, "title", `${label}缺少标题`);
    const category = text(item?.category);
    if (!category) {
      issue(issues, index, "category", `${label}缺少分类`);
    } else if (!isKnownCategory(category)) {
      issue(issues, index, "category", `${label}分类「${category}」不在固定分类列表`);
    }
    const imageUrl = text(item?.imageUrl);
    if (!imageUrl) {
      issue(issues, index, "imageUrl", `${label}缺少封面图`);
    } else if (GITHUB_BLOB_IMAGE.test(imageUrl)) {
      issue(issues, index, "imageUrl", `${label} imageUrl 不能是 GitHub blob 页面链接，请使用直链图片`);
    }
    if (!text(item?.prompt)) issue(issues, index, "prompt", `${label}缺少 Prompt`);

    for (const style of toList(item?.styles)) {
      if (!isKnownStyleToken(style)) {
        issue(
          issues,
          index,
          "styles",
          `${label} style「${style}」无法映射到中文标签，线上会以英文渲染并被 CI 拦截；${styleVocabHint()}`,
        );
      }
    }
    for (const scene of toList(item?.scenes)) {
      if (!isKnownSceneToken(scene)) {
        issue(
          issues,
          index,
          "scenes",
          `${label} scene「${scene}」无法映射到中文标签；${sceneVocabHint()}`,
        );
      }
    }
  });
  return issues;
}

/**
 * Validate data/manual/templates.json entries.
 * Supersedes template-validation-core.mjs (which now re-exports this) with
 * vocabulary + kebab-case + category rules matching the Hermes API contract.
 */
export function validateManualTemplates(templates) {
  const issues = [];
  const seen = new Map();
  toList(templates).forEach((item, index) => {
    const id = text(item?.id);
    const label = id ? `#${id}` : `第 ${index + 1} 条`;
    if (!id) issue(issues, index, "id", `第 ${index + 1} 条缺少 ID`);
    if (!text(item?.title)) issue(issues, index, "title", `${label}缺少标题`);
    if (!text(item?.prompt)) issue(issues, index, "prompt", `${label}缺少模板 Prompt`);
    if (!text(item?.cover)) issue(issues, index, "cover", `${label}缺少封面图`);
    const category = text(item?.category);
    if (!category) {
      issue(issues, index, "category", `${label}缺少分类`);
    } else if (!isKnownCategory(category)) {
      issue(issues, index, "category", `${label}分类「${category}」不在固定分类列表`);
    }

    if (id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      issue(issues, index, "id", `${label} ID 必须是英文 kebab-case`);
    }
    if (id) {
      const previous = seen.get(id);
      if (previous !== undefined) {
        issue(issues, index, "id", `#${id} ID 重复（第 ${previous + 1}、${index + 1} 条）`);
      } else {
        seen.set(id, index);
      }
    }
    for (const tag of toList(item?.tags)) {
      if (!isKnownTemplateTag(tag)) {
        issue(
          issues,
          index,
          "tags",
          `${label} 标签「${tag}」无法渲染为中文；请在 src/lib/labels-core.mjs 的 TEMPLATE_TAG_LABELS 补映射或改用现有标签`,
        );
      }
    }
    const sourceType = text(item?.sourceType);
    if (sourceType && !TEMPLATE_SOURCE_TYPES.has(sourceType)) {
      issue(issues, index, "sourceType", `${label} sourceType「${sourceType}」无效`);
    }
  });
  return issues;
}
