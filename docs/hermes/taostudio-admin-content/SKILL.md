---
name: taostudio-admin-content
description: Use when maintaining TaoStudio admin case or template content, including adding manual cases, adding reusable templates, deriving templates from cases, bulk-filling metadata, or reviewing data/manual/cases.json and data/manual/templates.json before saving.
---

# TaoStudio Admin Content

## Overview

Use this skill to maintain TaoStudio admin content without breaking the static GitHub-backed workflow. Treat cases as copyable finished examples and templates as reusable prompt structures.

## Required Context

Read the current files before editing:

- `data/manual/cases.json`
- `data/manual/templates.json`
- `data/manual/README.md`
- `src/admin/config.ts` for valid categories and common tags

## Case Workflow

1. Decide the task type:
   - Full Prompt plus result image: add or update a case.
   - No result image: do not publish as a finished case.
   - Hide an upstream item: write only `id` plus `hidden: true`.
2. Choose the ID:
   - New manual case: max manual numeric ID in the `100000+` range plus 1.
   - Upstream override or hide: use the upstream ID.
3. Fill required visible fields:
   - `id`
   - `title`
   - `category`
   - `styles`
   - `scenes`
   - `imageUrl`
   - `prompt`
4. Fill optional fields only when useful:
   - `tags`: dedupe `styles + scenes`, max 6.
   - `promptPreview`: flatten whitespace and clip around 220 chars unless a better card summary is provided.
   - `imageAlt`: use the title or a plain visual description.
   - `source` and `githubUrl`: fill only from evidence. Never invent.
5. Validate before saving:
   - JSON root remains an array.
   - ID is unique unless intentionally overriding upstream.
   - `imageUrl` is a direct image path, not a GitHub blob HTML page.
   - Full `prompt` is present; preview is not a substitute.

## Template Workflow

Create a template only when the pattern is reusable across multiple cases or high-frequency user tasks.

1. Confirm the pattern:
   - 3 or more cases share a structure, or
   - the topic is a durable content lane such as Xiaohongshu covers, merchant posters, ecommerce detail images, portraits, brand KV, or infographics.
2. Fill fields:
   - `id`: kebab-case English.
   - `title`: concise Chinese template name.
   - `category`: one valid category.
   - `tags`: 2-5 English tags.
   - `description`: one sentence explaining what the template generates.
   - `cover`: representative direct image path.
   - `prompt`: reusable structure with subject, scene, composition, style, and constraints.
   - `useWhen`: when to use this template.
   - `sourceType`: `manual` for hand-authored, `derived-case` when derived from cases.
   - `derivedFrom`: case IDs when derived.
3. Validate:
   - Prompt is not a copy of one single case.
   - Cover is accessible.
   - ID does not collide.

## Category And Tag Hints

| Signal | Category | Styles | Scenes |
|---|---|---|---|
| 小红书, cover, poster, social | 海报与排版 | Poster | Social |
| 门店, 餐饮, 奶茶, 促销, price | 海报与排版 | Poster, Realistic | Commerce |
| 商品, 包装, 主图, 详情页 | 产品与电商 | Studio, Realistic | Product, Commerce |
| 品牌, logo, KV, VI | 品牌与标志 | Editorial | Brand |
| 人像, 写真, 街拍, portrait | 摄影与写实 | Realistic | Portrait |
| 信息图, 科普, 图解, infographic | 图表与信息图 | Minimal | Infographic, Education |
| UI, app, dashboard, screenshot | UI 与界面 | Minimal | Tech |
| 建筑, 室内, city, space | 建筑与空间 | Realistic | Architecture |
| 分镜, cinematic, storyboard | 场景与叙事 | Cinematic | Editorial |

## Hard Rules

- Do not fabricate source, author, URL, date, model, or platform details.
- Do not replace the full Prompt with a summary.
- Do not store GitHub `blob` URLs as images.
- Do not publish images copied from social platforms or third-party sites unless explicit permission or license evidence is available.
- Prefer original Hermes-generated images, user-provided assets, or explicitly licensed assets.
- Do not delete unrelated manual entries during cleanup.
- Do not publish a template that only works for one exact case.
- Preserve existing hand-written optional fields unless explicitly asked to overwrite them.

## Review Checklist

Before reporting the work as ready:

- Case required fields are present for visible cases.
- Template required fields are present for templates.
- IDs are unique in the edited file.
- Categories match the fixed project category list.
- JSON parses as an array.
- Sources are evidence-backed or blank.
- The edited content can be saved through `/admin` without needing build-script changes.

## Self-Test Prompts

Use these prompts to check behavior:

1. Add a milk tea Xiaohongshu promo case with a known local upload image and unknown source.
2. Derive a reusable merchant poster template from five similar local business cases.
3. Bulk-fill missing `promptPreview` and `imageAlt` without overwriting existing `source`.
4. Hide upstream case ID 412 without changing any unrelated manual cases.

