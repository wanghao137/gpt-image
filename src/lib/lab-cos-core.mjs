/**
 * Shared COS URL builders for the 4K 实验室 section.
 *
 * Consumed by BOTH build-time scripts (scripts/build-lab-data.mjs) and
 * runtime rendering (src/lib/data-lab.ts, lab pages) so the imageMogr2 URL
 * scheme has a single source of truth. Plain .mjs on purpose — no TS import
 * friction from build scripts.
 *
 * Why preset imageMogr2 URLs instead of the generic transformUrl/wsrv path:
 * the site's audience is in mainland China. COS HK answers <100ms RTT from
 * CN telecom/unicom/mobile, while wsrv.nl resolves to North-American POPs.
 * These URLs must therefore go DIRECT to COS (see img.ts / SmartImg.tsx
 * imageMogr2 pass-through) and never be wrapped by a proxy.
 */

// Public bucket endpoint — public info (same value documented in
// .env.example / upload-cos.mjs). Not a secret; safe for the client bundle.
export const COS_PUBLIC_BASE = "https://gpt-image-2-1259488227.cos.ap-hongkong.myqcloud.com";

// 4K originals moved to Cloudflare R2 (2026-08-30): 5.74GB fits the 10GB
// free tier and R2 egress is free forever — the COS bill (~¥1/day under bot
// traffic) drops to ¥0. Bucket "taostudio-lab", public development URL
// enabled via CF API. Egress is free, so no hotlink protection is needed.
export const R2_PUBLIC_BASE = "https://pub-8e95aae17566496ba4c5e5ed16a824cf.r2.dev";

/** Width-bounded WebP thumbnail/detail variant of a lab original (COS CI). */
export function labImageUrl(cosKey, width, quality = 78) {
  return `${COS_PUBLIC_BASE}/${cosKey}?imageMogr2/thumbnail/${width}x/format/webp/q/${quality}`;
}

/** The untouched 4K PNG original — download links only. */
export function labOriginalUrl(cosKey) {
  const base = R2_PUBLIC_BASE ?? COS_PUBLIC_BASE;
  return `${base}/${cosKey}`;
}
