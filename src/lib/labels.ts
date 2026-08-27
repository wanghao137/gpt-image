/**
 * TS facade over the pure label maps in labels-core.mjs. UI components
 * import from here (typed); node scripts import labels-core.mjs directly.
 * See labels-core.mjs for the mapping table and its CI coverage test.
 */
export {
  IDENTITY_OK_LABELS,
  PLATFORM_LABELS,
  SCENE_LABELS,
  STYLE_LABELS,
  TEMPLATE_TAG_LABELS,
  platformLabel,
  sceneLabel,
  styleLabel,
  tagLabel,
  templateTagLabel,
} from "./labels-core.mjs";

/**
 * Accessible name for a case link, with a defensive fallback.
 *
 * Several surfaces (HeroStrip tiles, HeroFloatingDeck, CaseCard) render a
 * case as an image-only `<Link>` whose accessible name comes entirely from
 * `aria-label`. If a case's `title` is ever an empty string (dirty data, a
 * partial migration, etc.) the link ends up with NO accessible name, which
 * is a WCAG 2.4.4 / 4.1.2 failure and shows up as "link with no text" in
 * audits. We always fall back to the stable case id so every link is
 * announced — and trimmed of stray whitespace that would also read as empty.
 */
export function accessibleCaseLabel(c: { title?: string; id: string }): string {
  const title = (c.title || "").trim();
  return title ? `${title} · 案例 ${c.id}` : `案例 ${c.id}`;
}
