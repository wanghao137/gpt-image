/**
 * Image URL builders.
 *
 * After the August 2026 rewrite, every case image lives under `/images/`
 * on our own deployment (CF Pages). The `scripts/build-images.mjs` step
 * during `prebuild` downloads each upstream JPEG/PNG, resizes to a max
 * width of 1200 px, encodes JPEG q=80 mozjpeg, and writes to
 * `public/images/case<id>.jpg`. Then it rewrites `cases.json`'s
 * `imageUrl` to point at the local path.
 *
 * Net effect at runtime: every <img src> the page generates points at
 * `/images/<file>.jpg` on the same origin as the HTML — same edge POP,
 * same TLS connection, no transforms, no third-party CDNs. This is the
 * configuration the reference site (gpt-image2.canghe.ai) uses to ship
 * <300ms TTFB on Chinese mobile, and we're matching it.
 *
 * The helpers below are kept as no-ops for API compatibility with the
 * many call sites that pass through them. They no longer do any URL
 * mangling — the work has moved to build time.
 *
 * Anything that's NOT an /images/ path (data URLs, /uploads/* that the
 * pipeline missed, the rare absolute http URL) is passed through
 * verbatim. Callers that absolutely need a transform (OG cards in SEO
 * meta) can still call `rawTransformUrl` to hit wsrv directly.
 */

const WSRV = "https://wsrv.nl/";
const SITE_ORIGIN =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://gpt-image-6hu.pages.dev";

export interface ImgOpts {
  /** Render width in CSS pixels. Most call sites pass this; we ignore it
   *  unless the URL needs to round-trip through wsrv (rare). */
  width: number;
  /** 0–100. */
  quality?: number;
  format?: "webp" | "avif" | "auto";
}

/** True for `/images/*` — the canonical, pre-baked output path. */
function isLocalImage(src: string): boolean {
  return /^\/images\//i.test(src);
}

/**
 * Default image URL. Identity for local /images/* paths and for /assets/*
 * Vite bundles. Anything else (rare — would mean the build pipeline missed
 * a source) goes through wsrv as a runtime safety net.
 */
export function transformUrl(src: string, opts: ImgOpts): string {
  if (!src) return src;
  if (isLocalImage(src)) return src;
  if (src.startsWith("/assets/")) return src;
  return rawTransformUrl(src, opts);
}

/**
 * wsrv.nl direct URL. Only used for:
 *   - OG card images in SEO meta (scraped by Twitter/FB/WeChat, those go
 *     through non-CN IPs so wsrv's North-American POPs are fine for them)
 *   - very rare runtime-only URLs that didn't make it through the build
 *     pipeline (defensive)
 */
export function rawTransformUrl(src: string, opts: ImgOpts): string {
  if (!src) return src;
  // Promote relative paths to absolute so wsrv can fetch them.
  let abs = src;
  if (!/^https?:\/\//i.test(abs)) {
    abs = abs.startsWith("/") ? SITE_ORIGIN + abs : `${SITE_ORIGIN}/${abs}`;
  }
  const params = new URLSearchParams();
  params.set("url", abs.replace(/^https?:\/\//i, ""));
  params.set("w", String(Math.max(1, Math.round(opts.width))));
  params.set("output", opts.format ?? "webp");
  params.set("q", String(opts.quality ?? 78));
  params.set("we", "1");
  params.set("il", "1");
  return WSRV + "?" + params.toString();
}

/**
 * Same as `transformUrl`. Kept for back-compat with existing call sites
 * (CategoryShowcase, CaseDetailPage, etc.) that imported it before the
 * July 2026 simplification.
 */
export function optimizeImage(src: string, opts: ImgOpts): string {
  return transformUrl(src, opts);
}

/** Build a `srcset` string for transformable external URLs. */
export function srcSetFor(
  src: string,
  widths: number[],
  opts: Omit<ImgOpts, "width"> = {},
): string {
  if (!src || widths.length === 0) return "";
  if (isLocalImage(src) || src.startsWith("/assets/")) {
    return "";
  }
  return widths
    .map((w) => `${transformUrl(src, { ...opts, width: w })} ${w}w`)
    .join(", ");
}

/**
 * No-op for local images — there's no LQIP to generate when the asset
 * is already on our edge. Returns "" so SmartImg knows to skip the blur.
 *
 * For external URLs we still fall back to a tiny wsrv preview, which is
 * the only situation where we'd want one (and that's rare post-pipeline).
 */
export function lqipUrl(src: string): string {
  if (!src) return src;
  if (isLocalImage(src) || src.startsWith("/assets/")) return "";
  return rawTransformUrl(src, { width: 24, quality: 30 });
}

/** Sensible default width ladder for a given CSS-px render width. */
export function responsiveWidths(cssWidth: number): number[] {
  const w = Math.round(cssWidth);
  return Array.from(
    new Set([w, Math.round(w * 1.5), w * 2, Math.min(w * 3, 1600)]),
  ).sort((a, b) => a - b);
}
