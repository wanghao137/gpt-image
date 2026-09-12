import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const component = readFileSync(new URL("./TemplateCard.tsx", import.meta.url), "utf8");
const grid = readFileSync(new URL("./TemplateGrid.tsx", import.meta.url), "utf8");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "index.css"), "utf8");

test("template cards render covers at natural ratio with minimal text", () => {
  // 2026-09-12 user feedback: a fixed-ratio grid cropped every portrait cover
  // (22 portrait / 17 landscape / 9 square) to a sliver, and the card carried
  // an eyebrow + title + description + variables chip + capability strip +
  // two buttons. The card is now the cover at NATURAL ratio + title + copy.
  assert.match(component, /preserveAspectRatio/);
  assert.doesNotMatch(component, /aspect-\[\d+\/\d+\]/, "no fixed-ratio crop box");
  assert.doesNotMatch(component, /object-cover/);
  // minimal copy: title + one action only
  assert.match(component, /line-clamp-2 text-\[12\.5px\] font-medium/);
  assert.match(component, /复制模板/);
  assert.doesNotMatch(component, /展开 Prompt/);
  assert.doesNotMatch(component, /template-capability-strip/);
  assert.doesNotMatch(component, /line-clamp-2 text-\[13px] leading-relaxed/);
  // detail/lightbox affordances stay
  assert.match(component, /ImageLightbox/);
  assert.match(component, /to=\{detailHref\}/);
});

test("templates wall is the dense measured masonry (row-first, no reshuffle)", () => {
  assert.match(grid, /masonry masonry-dense/);
  assert.match(grid, /gridRowEnd/);
  assert.match(grid, /ResizeObserver/);
  // the dense ladder exists in CSS and the shared feed marker carries no rules
  assert.match(css, /\.masonry-dense\s*\{\s*column-count:\s*2/);
  assert.doesNotMatch(css, /\.masonry-feed\s*[,{]/);
});
