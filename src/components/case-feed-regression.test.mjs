import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("case feed appends ordered browse pages without remounting earlier cards", async () => {
  const [grid, card, casesPage, styles] = await Promise.all([
    readFile(new URL("./CaseGrid.tsx", import.meta.url), "utf8"),
    readFile(new URL("./CaseCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../pages/CasesPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../index.css", import.meta.url), "utf8"),
  ]);

  assert.match(grid, /const appendOnly =/);
  assert.doesNotMatch(grid, /visiblePages\.map/);
  assert.match(grid, /masonry-item/);
  assert.match(grid, /masonry-ready/);
  // Phone layout contract v2 (2026-09-12): ALL walls (cases / templates / lab)
  // run the same dense 2-column ladder on phones — 统一极简、空间用满. That is
  // only safe because the case card's copy now sits BELOW the image (slim
  // footer). The overlay-pinned design MUST NOT come back: at 50vw the
  // shortest images shrink to 70-110px and a pinned text box covers them
  // (27/72 cards broke that way in the v1 regression).
  assert.match(grid, /masonry masonry-feed masonry-dense/);
  assert.match(styles, /\.masonry-dense\s*\{\s*column-count:\s*2/);
  assert.doesNotMatch(
    styles,
    /\.masonry-feed\s*[,{]/,
    "`.masonry-feed` is shared by cases + lab; it must not carry CSS rules",
  );
  // no text pinned onto the case image on phones — footer-below-image only
  assert.doesNotMatch(
    card,
    /absolute inset-x-0 bottom-0[^"]*sm:hidden/,
    "case card text must stay below the image on phones",
  );
  // Specificity trap: `.masonry.masonry-ready { column-gap: 1rem }` outranks a
  // bare `.masonry` override no matter the source order, so the phone gap must
  // be restated with both classes — otherwise the hydrated grid keeps the 16px
  // desktop gap (and the 8px CSS-columns fallback shifts on hydration).
  assert.match(
    styles,
    /\.masonry\.masonry-ready\s*\{[^}]*column-gap:\s*0\.5rem/,
    "phone gap must target the ready grid, not only bare .masonry",
  );
  // Source-order trap: `.masonry-dense.masonry-ready` and the base
  // `.masonry.masonry-ready` have identical specificity, so the phone ladder
  // must sit AFTER the base rule — placed earlier it silently loses and the
  // wall measures back to one column (hit while writing this).
  const baseGridIdx = styles.indexOf(".masonry.masonry-ready {");
  const densePhoneIdx = styles.indexOf(".masonry-dense.masonry-ready");
  assert.ok(baseGridIdx > -1, "base .masonry-ready grid rule present");
  assert.ok(
    densePhoneIdx > baseGridIdx,
    "phone 2-col dense rule must come after the base masonry grid rule",
  );
  assert.match(grid, /ResizeObserver/);
  assert.match(grid, /getBoundingClientRect\(\)\.top <= window\.innerHeight \+ 600/);
  assert.match(grid, /aria-live="polite"/);
  assert.match(card, /preserveAspectRatio/);
  assert.match(card, /sm:flex-col/);
  // loadMoreBrowse keeps the ordered-append + dedup invariants: it walks
  // browse pages in order, merges through cachedBrowseCases()/uniqueCases,
  // and never lets a dedup-to-zero page become a silent no-op click.
  assert.match(casesPage, /uniqueCases\(\[\.\.\.HOME_DATA\.initial, \.\.\.pages\.flat\(\)\]\)/);
  assert.match(casesPage, /await loadBrowsePage\(page\)/);
  assert.match(casesPage, /setShardCases\(merged\)/);
  assert.match(casesPage, /consecutiveEmpty/);
  assert.doesNotMatch(casesPage, /BROWSE_CATEGORY_ORDER/);
  assert.doesNotMatch(casesPage, /browseLoading\s*\?\s*"正在加载更多案例/);
  assert.doesNotMatch(styles, /linear-gradient\(180deg, #fffaf2/);
  assert.doesNotMatch(styles, /\.case-card\s*\{[^}]*content-visibility:\s*auto/s);
});
