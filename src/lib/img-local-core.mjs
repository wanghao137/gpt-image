/**
 * Local /images/* path helpers — pure .mjs so `node --test` can exercise
 * them directly (repo pattern: .mjs core + TS wrapper in img.ts).
 *
 * LOCAL_IMAGE_BASE_RE accepts ONE optional nested directory level: the B2
 * image store serves /images/cases/<base>.jpg while legacy baked assets live
 * at /images/<base>.jpg. Deeper paths and non-canonical extensions (e.g.
 * the -320.webp variants themselves) return null and callers fall back to
 * the raw src.
 */
export const LOCAL_IMAGE_BASE_RE =
  /^(\/images\/(?:[^/?#]+\/)?[^/?#]+)\.(?:jpg|jpeg|png)$/i;

/** "/images/cases/case1.jpg" → "/images/cases/case1"; null when not a
 * canonical local raster path. */
export function localImageBase(src) {
  if (typeof src !== "string" || !/^\/images\//i.test(src)) return null;
  const m = src.match(LOCAL_IMAGE_BASE_RE);
  return m ? m[1] : null;
}
