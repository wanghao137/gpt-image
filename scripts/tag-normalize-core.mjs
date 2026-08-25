/**
 * Tag canonicalization for the case pipeline.
 *
 * WHY: the upstream tag pool accumulated synonyms ("Brand Identity" vs
 * "Brand", "3D" vs "3D Render") and tokens that appear in BOTH the style
 * and scene axes, which renders duplicate-looking filter chips that filter
 * different case sets. Rule set (decided 2026-08-25):
 *   - styles axis = how the image is painted; scenes axis = what it depicts.
 *   - Poster/Portrait/Character/Brand/Infographic belong to scenes.
 *   - Editorial belongs to styles.
 *   - "Artistic" is too generic next to Illustration/Realistic — dropped.
 *   - tags[] is a mixed free-tag pool: synonyms only, no group removal.
 */

export const TAG_SYNONYMS = new Map([
  ["Brand Identity", "Brand"],
  ["3D", "3D Render"],
]);

export const REMOVE_FROM_STYLES = new Set([
  "Poster",
  "Portrait",
  "Character",
  "Brand",
  "Infographic",
  "Artistic",
]);

export const REMOVE_FROM_SCENES = new Set(["Editorial", "Artistic"]);

export function normalizeTagToken(token) {
  const t = String(token ?? "").trim();
  return TAG_SYNONYMS.get(t) ?? t;
}

function cleanList(list, removeFrom) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const token = normalizeTagToken(raw);
    if (!token || removeFrom.has(token)) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out;
}

export function normalizeCaseTags(c) {
  return {
    styles: cleanList(c?.styles, REMOVE_FROM_STYLES),
    scenes: cleanList(c?.scenes, REMOVE_FROM_SCENES),
    tags: cleanList(c?.tags, new Set()),
  };
}
