# TaoStudio Frontend Development Plan

Date: 2026-07-17

Status: Approved for implementation by the user

Implementation status (2026-07-17): Phases 1-4 completed and browser-verified. The remaining Phase 5 accessibility, trust, and performance items are retained as follow-on work.

## Completed in this development run

- Phase 1: generated-data ID-set validation, stale-shard cleanup, hydration-stable totals, admin template required-field validation, and regression coverage.
- Phase 2: lazy full-index loading, staged category-shard browsing, explicit loading/error/retry states, full-index matching, and content-hash cache invalidation for generated search/filter/shard/index files.
- Phase 3: mobile 4:5 case previews with overlaid identity/actions, title-first mobile case details, independent template actions, valid card semantics, and CSS-column DOM order.
- Phase 4: audience-led homepage task entry points, high-value category ordering, template search/category/sort/result counts, template variable guidance, derived-case traceability, hot searches, and in-card Prompt preview.
- Final evidence: 13,048 canonical cases, full test/check pass, zero lint errors, successful production SSG build, and desktop/mobile browser screenshots under `output/playwright/product-design-audit-2026-07-17/`.

## Objective

Turn TaoStudio from a visually mature case gallery into a trustworthy, task-oriented Prompt discovery tool without discarding the existing peach brand, editorial typography, light/dark themes, or current content model.

The first release must prioritize correctness and task completion over adding new decorative layers.

## Success criteria

- The server and first client render use the same case count and initial data.
- Every current case is represented consistently in generated home, index, search, and category data.
- Searching never reports a false empty state while the full searchable dataset is still unavailable.
- The default cases route does not immediately download every case category plus an unused search index.
- Mobile users can identify a case and copy its Prompt without scrolling through a full-height image first.
- Case and template cards contain valid, predictable link/button semantics.
- Template publishing rejects missing required fields before any commit is attempted.
- Relevant typecheck, tests, lint, build, and desktop/mobile browser checks pass.

## Product principles

1. Preserve the existing visual system. Improve hierarchy and task clarity before changing brand styling.
2. Treat counts, filters, sources, and loading states as trust surfaces.
3. Fetch data according to user intent, not according to total inventory size.
4. Keep the primary action explicit: “Copy Prompt,” not a generic “Copy.”
5. Make mobile information order intentional rather than a desktop layout stacked vertically.
6. Use semantic HTML and predictable focus/keyboard behavior as part of product quality.

## Phase 1 — Data correctness and hydration

### Work

- Regenerate split public data from the current canonical case source.
- Add a reusable validation step that compares case ID sets and totals across:
  - `cases.json`
  - `cases-home.json`
  - `cases-index.json`
  - `cases-search.json`
  - generated category files
- Fail data generation/build when records are missing or totals diverge.
- Ensure `/cases` uses a hydration-stable total and initial list.
- Add regression tests for generated-data consistency and server/client initial rendering assumptions.

### Acceptance

- All generated datasets report the same 13,048 current case IDs, unless the source changes during the implementation.
- Browser console shows no React hydration mismatch on `/cases`.
- The 22 previously absent cases are searchable and appear in generated index data.

## Phase 2 — Search and loading architecture

### Work

- Split filter-option loading from search-index loading.
- Do not download the search index until a query or metadata filter needs it.
- Use the search index to determine matching IDs/categories instead of rebuilding search text only from already-loaded cards.
- Replace the initial `Promise.all` of every category with staged/on-demand loading.
- Add explicit states for:
  - initial loading
  - searching the full library
  - partial results while more data loads
  - empty results
  - network failure with retry
- Preserve URL-synchronized filters and return-position restoration.

### Acceptance

- The first `/cases` view loads an initial useful batch without requesting every category file.
- Query results are based on the full index, not only the initial 48 cards.
- A shard failure is shown as a retryable error rather than an empty library.
- Existing filter URL tests continue to pass.

## Phase 3 — Core mobile hierarchy and card semantics

### Work

- Case list:
  - constrain mobile preview media to a consistent ratio
  - expose title, category, favorite, and “Copy Prompt” before/beside the image fold
  - retain uncropped detail/lightbox media
- Case detail:
  - move title/category/source identity above the image on mobile
  - retain the sticky copy action and add enough bottom clearance
- Template card:
  - remove whole-card outer Link
  - make cover/title explicit detail links
  - make image preview, Prompt expansion, external source, and copy controls sibling actions
  - replace arrow-only expansion with explicit text
- Case card:
  - remove button-inside-Link structure
  - keep hover, prefetch, long-press, and favorite behavior
- Preserve DOM item order in the case grid.

### Acceptance

- No interactive element is nested inside another interactive element in case/template cards.
- At 390×844, the first case card exposes identity and a Prompt action without requiring the user to traverse the entire image height.
- At 390×844, a case detail shows the case title before the main image.
- Keyboard focus order follows the visual item order.

## Phase 4 — Product navigation and templates

Implementation status: completed on 2026-07-17.

### Work

- Add homepage task entry points for creators, merchants, and designers using existing categories and URLs.
- Reorder featured categories around high-value tasks.
- Add template category filtering, search, result count, and sorting.
- Add explicit template variable guidance and traceable derived-case links.
- Add hot searches and Prompt preview from case listings.

### Acceptance

- Each audience entry leads to a useful pre-filtered route.
- Users can reduce the template list by category and keyword.
- Template expansion, detail navigation, and copy actions are visually and semantically distinct.

### Verification evidence

- Audience task links resolve to real multi-category `/cases?cat=...` routes for creators, merchants, and designers.
- Template keyword search reduced 56 templates to 20 for `品牌`; adding `品牌与标志` reduced the list to 5; title sorting changed the visible order deterministically.
- Expanded template cards expose parsed variable names/defaults, and generated template details link back to real source case IDs through `/cases?q=<id>`.
- Hot search `产品海报` updated the URL and full-library query to one matching case; the case card exposed and expanded its Prompt preview without changing the copy/detail actions.
- Regression suite: 217/217 tests, TypeScript passed, lint 0 errors with 2 pre-existing Fast Refresh warnings, generated-data check 13,048 cases / 20 shards, deterministic production SSG build passed.
- Browser evidence: `output/playwright/product-design-audit-2026-07-17/phase4/`.

## Phase 5 — Accessibility, trust, and performance polish

Implementation status: completed on 2026-07-17.

### Work

- Add route-change focus management and result-count announcements.
- Add `aria-pressed`/selection semantics to filters and favorites.
- Complete mobile-menu Escape/focus behavior.
- Raise small dark-theme text to AA contrast where it conveys information.
- Normalize touch targets to at least 44px for core mobile controls.
- Limit eager/high-priority homepage imagery to true above-the-fold candidates.
- Remove or delay the boot overlay when meaningful SSG content is already available.
- Normalize source labels by domain and correct About-page claims.
- Add privacy, analytics, and source/licensing disclosure.
- Improve long-tail case rendering and social metadata.

## Implementation order for this development run

This run will implement Phases 1–3 first because they directly address incorrect content, false search behavior, hydration failures, and the most visible mobile friction.

Phases 1-5 are complete. Any further work should start from a fresh production audit rather than extending this plan by default.

## Verification matrix

- `npm run test`
- `npm run check`
- `npm run lint`
- `npm run build`
- Generated-data consistency check
- Desktop browser checks:
  - `/`
  - `/cases`
  - `/templates`
  - representative case detail
- Mobile browser checks at 390×844 for the same routes
- Browser console inspection for hydration/runtime errors
- Keyboard smoke test for case and template cards

## Risks and controls

- Generated-data changes may touch many tracked files. Review generated diffs separately from handwritten code.
- Search/loading changes can break filter URL synchronization or return restoration. Preserve current hooks and add focused regression tests before refactoring UI.
- Card semantic changes can alter click targets. Verify every visible action independently in desktop and mobile browsers.
- Image cropping can hide important content. Apply cropping only to list previews; retain full image access in details and lightbox.
- Do not commit, push, deploy, or publish without an explicit user request.
