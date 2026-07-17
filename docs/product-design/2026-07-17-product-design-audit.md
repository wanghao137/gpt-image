# TaoStudio Product Design Audit

Date: 2026-07-17

## Audit scope

This audit covers the primary public discovery flow in the current repository build:

1. Home page entry and positioning
2. Desktop case discovery and filtering
3. Mobile case discovery
4. Mobile template discovery
5. Mobile case-detail consumption and Prompt copying

The target users are Xiaohongshu creators, merchants, visual creators, and designers who want to move from an image reference to a reusable Prompt with minimal friction.

The accessibility target is WCAG 2.2 AA for the core discovery and copy flow. Screenshot evidence can identify visible risks, but semantic, keyboard, screen-reader, zoom, and network-state findings must also be verified in code and browser interaction tests.

## Overall verdict

TaoStudio already looks like a considered visual product rather than a generic asset directory. Its warm editorial palette, peach brand, image-led hero, responsive case cards, and Prompt-first language are strong foundations.

The main product gap is structural: the experience still optimizes for browsing a large gallery, while the stated users need a task-oriented path that helps them quickly choose a use case, inspect a Prompt, adapt it, and return to their work. Data inconsistency, incomplete filtering metadata, whole-library loading, and mobile information order currently weaken that path more than visual polish does.

## Flow steps

### Step 1 — Home page entry

Health: Good visual foundation, unclear task routing.

![Home page desktop](../../output/playwright/product-design-audit-2026-07-17/01-home-desktop.png)

Strengths:

- The hero has a memorable editorial composition and a clear primary CTA.
- Case, scene, and template counts communicate useful inventory depth.
- The image rail immediately demonstrates range and visual quality.

Risks:

- The only primary route is “browse all cases”; creator, merchant, and designer tasks are not surfaced as distinct starting points.
- The hero communicates inventory more clearly than workflow value.
- “12 use cases” reflects the featured subset rather than the full category system.

Opportunity:

- Add three audience/task entries that lead to pre-filtered results: creator covers and social visuals, merchant product and campaign visuals, and designer brand/editorial work.
- Keep the existing visual direction, but frame the next action as “start a task” rather than “enter the archive.”

### Step 2 — Desktop case discovery

Health: Feature-rich but overloaded and technically unreliable.

![Cases page desktop](../../output/playwright/product-design-audit-2026-07-17/02-cases-desktop.png)

Strengths:

- Search, scene, platform, style, and subject controls are visible without hidden navigation.
- Result count and favorites are discoverable.
- The masonry presentation makes mixed aspect ratios visually engaging.

Risks:

- Four filter axes dominate the first screen and delay the visual results.
- Style and scene filters appear authoritative although only about 1.26% of current cases contain those fields.
- The page loads all category shards while also downloading a search index that it does not use for matching.
- Server and client data totals differ, producing hydration mismatch errors and excluding 22 current cases from list/search data.
- The masonry DOM order differs from the visible reading order.

Opportunity:

- Make scene and platform the default controls; move style and subject into advanced filters until metadata coverage is trustworthy.
- Use the search index to identify matching IDs and fetch only relevant records.
- Preserve source order in the DOM and use layout styling rather than column-by-column DOM grouping.

### Step 3 — Mobile case discovery

Health: Usable controls, poor first-card information efficiency.

![Cases page mobile](../../output/playwright/product-design-audit-2026-07-17/03-cases-mobile.png)

Strengths:

- The mobile filter sheet keeps the desktop filter density out of the main viewport.
- Search and filter actions remain easy to find.
- The overall page reflows without horizontal overflow.

Risks:

- The first case image fills most of the remaining viewport; title, category, and copy action sit below it.
- Users cannot judge relevance or copy the Prompt without scrolling through the full image height.
- Some theme, filter, and favorite controls are below the preferred 44px touch size.

Opportunity:

- Use a controlled 4:5 preview crop for the list and overlay the title, category, and “Copy Prompt” action on the lower image region.
- Keep full-resolution uncropped imagery for the detail/lightbox experience.

### Step 4 — Mobile template discovery

Health: Strong content quality, weak navigation and action clarity.

![Templates page mobile](../../output/playwright/product-design-audit-2026-07-17/04-templates-mobile.png)

Strengths:

- Template covers, categories, titles, descriptions, and applicability tags communicate quality.
- The card visual language fits the rest of the product.

Risks:

- Fifty-six templates across thirteen categories are presented as one undifferentiated list.
- The expand action is represented by a small arrow and competes with whole-card navigation and copy actions.
- The outer card link contains nested buttons and links, creating invalid interactive semantics.
- “remix” becomes an orphaned line at the audited mobile width.

Opportunity:

- Add category tabs, search, and sorting.
- Replace the arrow with explicit “Expand Prompt / Collapse” copy.
- Make cover and title the detail links, with preview and copy actions as sibling controls.
- Evolve template details into a variable replacement workbench rather than a raw Prompt viewer.

### Step 5 — Mobile case detail and copy

Health: Strong sticky action, weak content hierarchy.

![Case detail mobile](../../output/playwright/product-design-audit-2026-07-17/05-case-detail-mobile.png)

Strengths:

- The sticky “Copy Prompt” action is prominent and thumb reachable.
- The full image is presented clearly and supports enlargement.
- Breadcrumbs and source information are visible.

Risks:

- The case title is not visible before the large image, so the first screen lacks a clear content identity.
- Source text mixes English collection metadata into a Chinese product surface.
- Source links are modeled as GitHub links even when many point to X.
- Long-tail cases that are not prerendered can begin with an empty SPA shell and lack shareable server metadata.

Opportunity:

- Move title, category, source type, and essential Prompt metadata above the image on mobile.
- Normalize source labeling by domain.
- Provide Chinese, English, and full-Prompt copy modes where data supports them.

## Highest-impact recommendations

1. Establish one canonical generated dataset and fail the build when case IDs or totals diverge across source, home, index, search, and category files.
2. Replace whole-library loading with indexed, on-demand case retrieval and explicit loading/error states.
3. Fix mobile list/detail information order so title and copy actions are available before a full-height image.
4. Remove nested interactive elements from case and template cards and preserve logical DOM reading order.
5. Add task-led homepage entry points and category/search navigation for templates.
6. Improve source transparency, privacy/licensing copy, and long-tail detail rendering/metadata.

## Evidence limits

- The screenshots confirm visual hierarchy, density, reflow, and visible affordances.
- Code inspection and browser logs were used to confirm hydration, data-loading, semantic, and server-rendering risks.
- Full screen-reader behavior, 200%/400% zoom, production analytics performance, and real weak-network timings still require dedicated verification after implementation.
