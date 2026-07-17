# Product Design QA

Date: 2026-07-17

## Comparison targets

- Source visual truth: baseline captures in `output/playwright/product-design-audit-2026-07-17/01-home-desktop.png` through `05-case-detail-mobile.png`.
- Rendered implementation: `http://127.0.0.1:4173/` serving the final production `dist` build.
- Desktop viewport: 1440 x 1000.
- Mobile viewport: 390 x 844.
- Theme/state: system/light appearance, public unauthenticated routes, representative default/search/expanded states.

## Full-view comparison evidence

- Home desktop: baseline `01-home-desktop.png`; implementation `12-home-desktop-after.png`.
- Cases desktop: baseline `02-cases-desktop.png`; implementation `06-cases-desktop-after.png`.
- Cases mobile: baseline `03-cases-mobile.png`; implementation `07-cases-mobile-after.png`.
- Templates mobile: baseline `04-templates-mobile.png`; implementation `10-templates-mobile-after.png`.
- Case detail mobile: baseline `05-case-detail-mobile.png`; implementation `11-case-detail-mobile-after.png`.

## Focused region evidence

- Mobile case card: `08-case-card-mobile-after.png` confirms the 4:5 preview, title, source, category, favorite, Copy Prompt, and more-actions controls in one card view.
- Search result: `09-search-28845-after.png` plus the browser accessibility snapshot confirms one full-library result for case 28845.
- Focused regions were required because card action labels and semantic separation are too small to judge reliably from the full-page captures alone.

## Findings

No actionable P0, P1, or P2 visual/product findings remain in the implemented Phase 1-3 scope.

- Typography: the existing editorial display/body families, weights, wrapping, hierarchy, and Chinese/English pairing remain consistent. Mobile detail identity is now visible before the image; template expansion uses readable text instead of an arrow-only affordance.
- Spacing and layout rhythm: existing page margins, radii, filters, and warm editorial spacing are preserved. Mobile case previews use a stable 4:5 frame, while desktop cards retain decoded image ratios. CSS columns preserve visible and keyboard reading order.
- Colors and tokens: the peach accent, warm paper background, border opacity, dark/light theme tokens, and action contrast remain aligned with the source product system.
- Image quality and asset fidelity: all visible imagery uses existing production assets; list previews use controlled cropping while detail/lightbox views retain full imagery. No replacement CSS art, placeholder illustration, or custom SVG asset was introduced.
- Copy and content: primary actions now consistently say `复制 Prompt`; template expansion says `展开 Prompt / 收起 Prompt`; case totals are corrected from 13,026 to 13,048.
- Responsiveness and accessibility: core mobile controls are 44px, favorites expose `aria-pressed`, template expansion exposes `aria-expanded`, link/button nesting was removed, and the mobile detail title precedes the image.
- Runtime: `/cases` initially requested only `cases-xhs-cover.json`, not all 20 shards. Full search requested `cases-search.json?v=ef837ad2debc`, bypassing the stale baseline cache. Case 28845 returned `1 / 13048 匹配`.

## Comparison history

### Iteration 1 - baseline audit

- P1: generated home/index/search/category data omitted 22 canonical cases and caused a 13,026 vs 13,048 hydration mismatch.
- P1: default case discovery downloaded the full inventory architecture instead of a staged useful batch.
- P1: mobile case identity/copy controls appeared after a tall image; mobile detail identity appeared after the image.
- P1: template cards nested interactive controls and used an arrow-only expansion action.
- P2: manual column redistribution made DOM/keyboard order differ from visual reading order.

Fixes: added generated-data consistency gates; regenerated 13,048 records; introduced indexed staged loading; rebuilt mobile card/detail hierarchy; separated template links and buttons; moved masonry flow to CSS columns.

Post-fix evidence: `06-cases-desktop-after.png`, `07-cases-mobile-after.png`, `08-case-card-mobile-after.png`, `10-templates-mobile-after.png`, and `11-case-detail-mobile-after.png`.

### Iteration 2 - browser search regression

- P1: case 28845 existed in the new index but a browser with the old `force-cache` entry still returned zero results because generated JSON URLs were not versioned.

Fix: generated a SHA-256-derived content revision in `cases-home.json` and appended it to search, filter, category-shard, and case-index requests.

Post-fix evidence: browser search returned `1 / 13048 匹配`; the recorded request was `cases-search.json?v=ef837ad2debc`; screenshot `09-search-28845-after.png`.

## Primary interactions tested

- Default `/cases` staged loading and initial network requests.
- Search for a previously absent case ID (`28845`).
- Template Prompt expansion (`aria-expanded` changed to `true`).
- Independent template detail, image preview, expansion, and copy controls via accessibility snapshot.
- Mobile case-card favorite/copy/more controls and mobile detail sticky Copy Prompt action.
- Console inspection on cases, templates, and case detail.

## Console and evidence limits

- No React hydration or application runtime errors were observed.
- Local preview reports two expected 404s for Vercel Analytics and Speed Insights scripts; those endpoints exist only in the deployment environment and are not Phase 1-3 regressions.
- Screen-reader announcements, 200%/400% zoom, real weak-network timings, production analytics, and every dark-theme route remain follow-on verification work.

## Follow-up polish

- Phase 5: route focus management, live result announcements, complete menu focus trapping, source/privacy/licensing normalization, and long-tail social metadata.

## Phase 4 QA addendum

Phase 4 passed functional and responsive review while preserving the existing peach editorial system.

- Homepage: three task-led entries for content creators, brands/merchants, and designers use existing multi-category case URLs. Featured categories now lead with Xiaohongshu covers, ecommerce imagery, and merchant posters. Evidence: `phase4/01-home-task-entry-desktop.png`.
- Templates: keyword search, category filtering, result counts, and curated/newest/title sorting work at desktop and mobile widths. Variable counts are visible on cards; expanded cards show parsed names and defaults. Evidence: `phase4/02-templates-mobile.png`.
- Template provenance: generated templates expose real `derivedFrom` IDs as case-library links on cards and detail pages; `/template/derived-xhs-cover` showed five traceable cases.
- Cases: hot-search chips replace conflicting filters, synchronize the `q` URL, and use the full search index. Case cards expand a readable Prompt preview with a separate full-detail link. Evidence: `phase4/03-cases-mobile.png`.
- Browser interaction checks covered audience-route navigation, hot search, Prompt preview, template keyword/category/sort controls, variable guidance, and derived-case links.
- Dev SSR console: 0 application errors/warnings. Current production baseline `/cases` and `/templates`: 0 errors/warnings. Local `vite preview` continues to emit its environment-specific hydration/analytics noise even when Phase 4 initial DOM is removed; it was not used as the application-runtime verdict.

final result: passed
