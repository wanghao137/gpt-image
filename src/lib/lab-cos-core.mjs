/**
 * Shared URL builders for the 4K 实验室 section.
 *
 * Consumed by BOTH build-time scripts (scripts/build-lab-data.mjs) and
 * runtime rendering (src/pages/LabDetailPage.tsx) so lab URLs have a single
 * source of truth. Plain .mjs on purpose — no TS import friction from build
 * scripts.
 *
 * History: originals used to live on COS HK with imageMogr2 preset URLs
 * (labImageUrl). The 2026-08-30 R2 move EMPTIED the COS bucket, so every
 * imageMogr2 URL now 404s and that builder was deleted. R2 serves raw
 * objects only — no on-the-fly resize — so baked same-origin WebPs are the
 * browse path and the R2 original doubles as the emergency fallback when a
 * baked variant is missing. Keep these URLs direct (never wsrv-proxied):
 * the audience is in mainland China and proxy POPs are slow there.
 */

// 4K originals on Cloudflare R2: 5.74GB fits the 10GB free tier and R2
// egress is free forever — the former COS bill (~¥1/day under bot traffic)
// is ¥0. Bucket "taostudio-lab", public development URL enabled via CF API.
// Not a secret; safe for the client bundle.
export const R2_PUBLIC_BASE = "https://pub-8e95aae17566496ba4c5e5ed16a824cf.r2.dev";

/** The untouched 4K PNG original — download links + emergency fallback. */
export function labOriginalUrl(cosKey) {
  return `${R2_PUBLIC_BASE}/${cosKey}`;
}
