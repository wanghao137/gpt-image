/**
 * Shared real-pixel transparency gate for the 4K lab.
 *
 * Single source of truth used by BOTH the importer (scripts/import-lab.mjs —
 * decides whether a candidate may be uploaded/registered) and the bake gate
 * (scripts/build-lab-web-images.mjs — hard-fails the build if a transparent
 * entry ever reaches public/lab-images). Keeping the two in one module
 * guarantees the import decision and the build gate can never drift apart.
 *
 * Policy: the metadata flag params.transparent_output is UNRELIABLE in both
 * directions — 2026-08-29 two meme sticker packs shipped WITHOUT the flag,
 * and 2026-09-09 several fully opaque renders were flagged true. Only the
 * real alpha channel decides. Threshold is a FRACTION of pixels with
 * alpha < 128 over the whole canvas, not a per-pixel minimum: a stray
 * anti-aliased edge pixel (alphaMin < 250, ~0.01% coverage) must not sink a
 * solid image, while a true sticker sheet / transparent-output render has
 * 30%+ of its canvas transparent. We exclude >= 10%.
 */
import sharp from "sharp";

/** Fraction of canvas pixels whose alpha < 128 (i.e. meaningfully see-through).
 *  Returns 0 for images with no alpha channel. Throws only if unreadable. */
export async function transparentFraction(file) {
  const image = sharp(file);
  const md = await image.metadata();
  if (!md.hasAlpha) return 0;
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const n = data.length / ch;
  let t = 0;
  for (let i = 3; i < data.length; i += ch) if (data[i] < 128) t += 1;
  return t / n;
}

/** True when the image belongs to the transparent/sticker lane. */
export async function isTransparentImage(file) {
  try {
    return (await transparentFraction(file)) >= 0.1;
  } catch {
    // Unreadable here → let the uploader/baker surface the real error later.
    return false;
  }
}
