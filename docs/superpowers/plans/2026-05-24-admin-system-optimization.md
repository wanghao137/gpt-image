# Admin System Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin system match the public theme modes, reduce case/template content entry friction, and ship a Hermes-ready workflow skill.

**Architecture:** Keep the static admin architecture and GitHub Contents API write path. Add deterministic admin content helpers in a small pure module, wire them into existing editors, and reuse the public theme core for admin mode switching. Store Hermes guidance under `docs/hermes/` in both readable and standard skill forms.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Node test runner, GitHub Contents API.

---

### Task 1: Admin Content Helper Tests

**Files:**
- Create: `src/admin/content-automation-core.mjs`
- Create: `src/admin/content-automation-core.d.mts`
- Create: `scripts/admin-content-automation.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  inferCaseFields,
  inferTemplateFields,
  makePromptPreview,
} from "../src/admin/content-automation-core.mjs";

test("makePromptPreview flattens whitespace and clips long prompts", () => {
  const prompt = "第一行\n\n第二行 " + "细节".repeat(140);
  const preview = makePromptPreview(prompt, 80);
  assert.equal(preview.includes("\n"), false);
  assert.equal(preview.length, 80);
  assert.equal(preview.endsWith("…"), true);
});

test("inferCaseFields fills preview alt styles scenes and tags from prompt signals", () => {
  const result = inferCaseFields({
    id: "100123",
    title: "小红书奶茶新品促销海报",
    category: "海报与排版",
    styles: [],
    scenes: [],
    imageUrl: "/uploads/milk-tea.jpg",
    prompt:
      "为本地奶茶门店生成竖版 poster，突出限时促销、价格标签、手机端可读标题和真实商品摄影。",
  });

  assert.equal(result.promptPreview.startsWith("为本地奶茶门店生成竖版 poster"), true);
  assert.equal(result.imageAlt, "小红书奶茶新品促销海报");
  assert.ok(result.styles.includes("Poster"));
  assert.ok(result.styles.includes("Realistic"));
  assert.ok(result.scenes.includes("Commerce"));
  assert.ok(result.scenes.includes("Social"));
  assert.ok(result.tags.includes("Poster"));
  assert.ok(result.tags.includes("Commerce"));
});

test("inferTemplateFields fills empty template helper copy without overwriting prompt", () => {
  const result = inferTemplateFields({
    id: "derived-local-promo",
    title: "本地商家促销海报",
    category: "海报与排版",
    tags: [],
    description: "",
    cover: "/images/template.jpg",
    prompt: "模板 Prompt 正文",
    useWhen: "",
  });

  assert.equal(result.prompt, "模板 Prompt 正文");
  assert.equal(result.description, "用于海报与排版的本地商家促销海报模板。");
  assert.equal(result.useWhen, "适合需要快速复用「本地商家促销海报」结构的内容生产场景。");
  assert.ok(result.tags.includes("Poster"));
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm run test -- scripts/admin-content-automation.test.mjs`

Expected: FAIL because `src/admin/content-automation-core.mjs` does not exist.

- [ ] **Step 3: Implement helper module**

Create the helper module with exported `makePromptPreview`, `inferCaseFields`, and `inferTemplateFields`. Use deterministic keyword tables only.

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `npm run test -- scripts/admin-content-automation.test.mjs`

Expected: PASS.

### Task 2: Case Editor UX

**Files:**
- Modify: `src/admin/ui/CaseEditor.tsx`
- Modify: `src/admin/admin.css`

- [ ] **Step 1: Import helper**

Import `inferCaseFields` from `../content-automation-core.mjs`.

- [ ] **Step 2: Add publish/advanced grouping**

Keep title, image, prompt, and category visible in the primary flow. Move styles, scenes, source, link, imageAlt, and hidden into collapsible advanced sections.

- [ ] **Step 3: Add smart fill actions**

Add buttons for "智能补全" and "只补空字段". They call `inferCaseFields(data, { overwrite: true | false })` and pass the result to `onChange`.

- [ ] **Step 4: Preserve save validation**

Keep required-field validation for visible cases and existing duplicate ID checks.

### Task 3: Template Editor UX

**Files:**
- Modify: `src/admin/ui/TemplateEditor.tsx`
- Modify: `src/admin/admin.css`

- [ ] **Step 1: Import helper**

Import `inferTemplateFields` from `../content-automation-core.mjs`.

- [ ] **Step 2: Add template smart fill**

Add a compact toolbar with "智能补全" and "只补空字段" for tags, description, and useWhen.

- [ ] **Step 3: Group fields**

Keep title, cover, prompt, and useWhen prominent. Put tags and description in a supporting metadata area.

### Task 4: Admin Theme Modes

**Files:**
- Modify: `admin.html`
- Modify: `src/admin/ui/Shell.tsx`
- Modify: `src/admin/admin.css`

- [ ] **Step 1: Add boot theme script**

Before the admin boot CSS paints, read `taostudio.theme`, resolve system preference, set `document.documentElement.dataset.theme`, update `colorScheme`, and update theme-color.

- [ ] **Step 2: Add React theme switcher**

Add local state in `Shell.tsx` using `parseThemeMode`, `resolveEffectiveTheme`, `getSystemTheme`, and `applyThemeToDocument`. Persist the selected mode to `localStorage`.

- [ ] **Step 3: Add light admin CSS hooks**

Add `:root[data-theme="light"]` overrides for admin body background, form inputs, sidebar, top bar, cards, nav rows, drop zones, and badges.

### Task 5: Hermes Documentation and Standard Skill

**Files:**
- Create: `docs/hermes/taostudio-admin-content-skill.md`
- Create: `docs/hermes/taostudio-admin-content/SKILL.md`

- [ ] **Step 1: Write readable workflow document**

Document case creation, template creation, bulk fill, save validation, and review requirements in Chinese.

- [ ] **Step 2: Write standard skill**

Use valid YAML frontmatter with `name: taostudio-admin-content` and a trigger-focused `description`. Include quick reference tables and concrete field rules.

- [ ] **Step 3: Add test prompts inside the docs**

Include realistic prompts that Hermes can use to self-check the workflow.

### Task 6: Verification

**Files:**
- No source edits unless verification reveals issues.

- [ ] **Step 1: Run focused tests**

Run: `npm run test -- scripts/admin-content-automation.test.mjs`

- [ ] **Step 2: Run full tests**

Run: `npm run test`

- [ ] **Step 3: Run typecheck**

Run: `npx tsc -b`

- [ ] **Step 4: Run production build**

Run: `npm run build`

- [ ] **Step 5: Browser check admin**

Start the local dev server, open `/admin`, and verify the admin renders in light and dark modes at desktop and mobile widths.

