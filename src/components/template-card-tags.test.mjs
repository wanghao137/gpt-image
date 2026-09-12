import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("./TemplateCard.tsx", import.meta.url), "utf8");

test("template card is image-first: tags/copy live on the picture, not a text page", () => {
  // 2026-09-12 user feedback: the card carried an eyebrow + 3-line title +
  // description + variables chip + a bordered capability strip + two stacked
  // buttons under a ~110px thumbnail — "字太多，图片太小". The card is now the
  // picture: category/title/copy sit on the image gradient on phones, and the
  // capability strip moved to the detail page (which renders its own tags).
  assert.doesNotMatch(component, /template-capability-strip/);
  assert.doesNotMatch(component, /展开后逐项填写/);
  // phone: clean cover + slim footer (title + copy) — no scrim panel over the
  // thumbnail, no eyebrow/description/variables/tags on the card
  assert.match(component, /aspect-\[4\/3\][^"']*sm:aspect-\[16\/10\]/);
  assert.match(component, /px-2 py-1\.5 sm:hidden/);
  assert.match(component, /line-clamp-2 text-\[12px\] font-semibold/);
  assert.match(component, /mt-1\.5 inline-flex h-8 w-full/);
  // desktop keeps a trimmed body; the expand/copy actions stay functional
  assert.match(component, /hidden flex-1 flex-col[^"]*sm:flex/);
  assert.match(component, /aria-expanded=\{expanded\}/);
});
