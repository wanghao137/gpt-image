# TaoStudio Project Guide

## Project Context

This repo powers TaoStudio's prompt gallery, static public data pipeline, admin
content workflow, and Hermes server-side content publishing path.

Before editing content, admin, or publishing flows, read the relevant current
sources:

- `data/manual/cases.json`
- `data/manual/templates.json`
- `data/manual/README.md`
- `src/admin/config.ts`
- `docs/hermes/HERMES_ADMIN_API.md`
- `docs/hermes/HERMES_AUTOMATION_HANDOFF.md`
- `.agents/skills/taostudio-admin-content/SKILL.md` when maintaining cases or
  templates

## Data And Content Rules

- Treat cases as finished copyable examples and templates as reusable prompt
  structures.
- Keep manual source data, generated `public/data` output, prompt JSON, and image
  assets consistent with the existing scripts.
- Do not invent source URLs, GitHub URLs, image paths, or upload paths.
- When adding templates, use durable reusable patterns, not one-off case copies.
- Preserve Chinese copy quality and payload fidelity; avoid PowerShell text
  writes for Chinese JSON or markdown content.

## Hermes Rules

- Hermes should use the server-side API contract, not browser-admin login.
- Hermes needs only `HERMES_ADMIN_API_KEY`; the Vercel server function owns
  GitHub writes through server-side environment variables.
- Never place real `HERMES_ADMIN_API_KEY`, `HERMES_GITHUB_TOKEN`, OpenAI keys, or
  provider model keys in chat, tracked docs, examples, generated prompts, or logs.
- Use `dryRun` validation before real publishing when operating Hermes flows.

## Development Commands

Use repo scripts:

- Install dependencies only when needed: `npm install`
- Dev server: `npm run dev`
- Typecheck and tests: `npm run check`
- Tests only: `npm run test`
- Lint: `npm run lint`
- Build: `npm run build`
- Sync/migrate/images when needed: `npm run sync`, `npm run migrate`,
  `npm run images`

Run the smallest relevant checks first. For public UI, admin, routing, or static
data changes, finish with `npm run check` and `npm run build` unless there is a
clear reason to report them as skipped.

## Browser And Data Verification

- Browser-check changed public pages or admin flows when the behavior is visible.
- For gallery/template changes, verify that generated data and images resolve
  from the static app, not only from source JSON.
- Watch for hydration regressions, missing images, broken prompt detail pages,
  and category/filter inconsistencies.

## Git And Scope

- Do not commit, push, deploy, or publish unless the user explicitly asks.
- Keep `.env.local`, `.env`, `.omx/`, and temporary build output out of commits.
- Keep content-generation changes separate from configuration or workflow cleanup
  so reviews can distinguish publishing output from agent setup.
- If the worktree is already dirty, inspect the existing changes and avoid
  overwriting unrelated user or generated work.
