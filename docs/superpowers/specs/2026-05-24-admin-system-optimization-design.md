# Admin System Optimization Design

## Context

The admin app is a separate Vite entry at `admin.html` and `src/admin/main.tsx`. It writes `data/manual/cases.json`, `data/manual/templates.json`, and `public/uploads/*` through the GitHub Contents API. The public site already has a shared theme key and resolver in `src/lib/theme-core.mjs`; the admin imports the public CSS but currently boots and runs as dark-only.

The current case editor exposes most manual JSON fields at once. That preserves data control, but it makes day-to-day case publishing feel like JSON authoring instead of content management. The requested change is to keep the manual JSON contract stable while making the default admin path faster and clearer.

## Goals

1. Match the public site's theme modes in admin: light, dark, and system.
2. Reduce case entry friction by making required fields prominent and moving low-frequency fields into an advanced area.
3. Add deterministic smart fill helpers for case and template metadata.
4. Produce a Hermes-ready workflow as both a readable project document and a standard `SKILL.md`.
5. Preserve the current static architecture: no server, no model key in the browser, no schema-breaking data migration.

## Non-Goals

- Do not add a server, edge function, or AI model call from the admin bundle.
- Do not remove fields from `data/manual/cases.json` or `data/manual/templates.json`.
- Do not rewrite the public case/template rendering surface.
- Do not change GitHub authentication or upload storage.

## Design

### Theme

Admin uses the same `taostudio.theme` localStorage key as the public site. `admin.html` runs an inline boot script before paint to resolve `light`, `dark`, or `system`, set `data-theme`, set `color-scheme`, and update theme-color. The React admin shell adds a compact mode switcher in the top bar so the same preference applies across public and admin pages.

Admin CSS keeps its tool-like density, but it must define light-theme overrides for form controls, sidebar, top bar, cards, badges, and image drop surfaces. The target is operational clarity, not a marketing page.

### Case Editor

The case form becomes a three-layer editor:

- Publish fields: `title`, `imageUrl`, `prompt`, `category`.
- Smart fill: buttons that infer `promptPreview`, `imageAlt`, `styles`, `scenes`, and optional tags from title, category, and prompt.
- Advanced fields: source, original link, accessibility text override, hidden upstream flag, manual style/scene chips.

The editor does not hide power-user control. Instead, it defaults to the few fields needed to publish, then lets the user review or override inferred values.

### Template Editor

The template form keeps the existing data shape and adds a light smart fill action for `description`, `useWhen`, and `tags`. It also gets clearer grouping so template authoring reads as reusable pattern design instead of a long text form.

### Inference Helpers

Inference is deterministic JavaScript, not AI:

- `promptPreview`: flatten whitespace and clip to a stable max length.
- `imageAlt`: use title when present, otherwise a neutral case/template fallback.
- `styles` and `scenes`: keyword rules over title, category, prompt, and existing tags.
- `template.description` and `template.useWhen`: generated from title/category/tags only when empty or explicitly requested.

The helpers live in a small admin core module and are covered by Node tests. UI code calls them, but the logic stays testable without React or a browser.

### Hermes Skill

The project document explains the workflow in Chinese for direct use. The standard skill directory contains a `SKILL.md` with:

- trigger conditions for case, template, bulk fill, and review tasks;
- input contract and required evidence;
- field mapping rules for cases and templates;
- save and validation steps;
- common failure modes such as GitHub blob URLs, fabricated sources, missing prompt bodies, and broken JSON arrays.

Because this is project-specific operational knowledge, the skill is stored in the repo under `docs/hermes/` rather than installed globally.

## Data Compatibility

Manual case fields remain backward-compatible:

- Required at save for visible cases: `id`, `title`, `imageUrl`, `prompt`.
- Kept optional: `promptPreview`, `imageAlt`, `source`, `githubUrl`, `tags`.
- Existing build scripts continue to derive v2 public fields during `sync` and `migrate`.

Manual template fields remain compatible with `PromptTemplate` and `mergeTemplateCollections`.

## Error Handling

Save validation remains local and blocks missing required visible case fields. Smart fill never silently saves. It only updates the current draft and marks it dirty. GitHub API failures continue through existing toast errors.

If a theme preference is invalid or localStorage is unavailable, admin falls back to system mode and then to dark.

## Testing

Add Node tests for deterministic admin content helpers. Reuse existing theme-core tests for shared mode parsing and add admin-specific coverage only where new pure helpers exist.

Verification commands:

- `npm run test`
- `npx tsc -b`
- `npm run build`
- browser verification for `/admin` at desktop and mobile widths, including light/dark/system UI rendering.

