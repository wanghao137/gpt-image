/**
 * Image optimization helpers.
 *
 * Strategy (mobile-first, China-friendly):
 *
 *   1. Default delivery goes through wsrv.nl — a free Cloudflare-backed proxy
 *      that resizes on the fly and serves WebP/AVIF. This dramatically cuts
 *      mobile payload without us running our own CDN.
 *
 *   2. For raw GitHub-hosted assets we expose a `mirrorOrigin()` helper that
 *      rewrites `raw.githubusercontent.com` URLs to `cdn.jsdelivr.net`, which
 *      is consistently faster than raw GitHub from mainland China and is
 *      already preconnected in `index.html`. SmartImg uses this as the
 *      "stage 1" fallback when the optimization proxy hangs.
 *
 *   3. `lqipUrl()` produces a tiny ~24px blurred preview suitable for inline
 *      <img> "blur-up" placeholders.
 *
 *   4. Real-DPR srcset support: callers should pass widths covering DPR=3
 *      devices (most high-end Android phones). See `responsiveWidths()` for
 *      a sensible default ladder.
 */

const PROXY = "https://wsrv.nl/";

export interface ImgOpts {
  /** Render width in CSS pixels; the proxy delivers at this exact width. */
  width: number;
  /** 0–100. Defaults to 78 — visually lossless for our use case. */
  quality?: number;
  /**
   * Output format. Defaults to "webp" because it's universally supported and
   * has predictable decoding cost. Use "avif" only when callers can ensure
   * the consumer can fall back gracefully.
   */
  format?: "webp" | "avif" | "auto";
}

function isProxyable(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/**
 * Rewrite `raw.githubusercontent.com/<user>/<repo>/<branch>/<path>` to the
 * jsDelivr equivalent `cdn.jsdelivr.net/gh/<user>/<repo>@<branch>/<path>`.
 * jsDelivr has dramatically better mainland-China latency than GitHub raw
 * and is already in our `<link rel="preconnect">` set.
 *
 * Returns the input unchanged when the URL doesn't match GitHub raw form.
 */
export function mirrorOrigin(src: string): string {
  if (!src) return src;
  const m = src.match(
    /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i,
  );
  if (!m) return src;
  const [, user, repo, branch, path] = m;
  return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
}

/** Returns a proxied/optimized image URL. Returns the input unchanged when proxying isn't safe. */
export function optimizeImage(src: string, opts: ImgOpts): string {
  if (!src || !isProxyable(src)) return src;
  // Prefer the jsdelivr origin so the proxy fetches from a fast CDN, not raw GitHub.
  const origin = mirrorOrigin(src);
  const params = new URLSearchParams();
  // wsrv accepts the url without scheme — keeps the query string short.
  params.set("url", origin.replace(/^https?:\/\//i, ""));
  params.set("w", String(Math.round(opts.width)));
  params.set("output", opts.format ?? "webp");
  params.set("q", String(opts.quality ?? 78));
  // `we=1` = no enlargement past source size; avoids wasted bytes for small originals.
  params.set("we", "1");
  // `il=1` = interlaced/progressive output, gives perceived earlier paint on slow connections.
  params.set("il", "1");
  return PROXY + "?" + params.toString();
}

/** Build a `srcset` string for the given widths. */
export function srcSetFor(
  src: string,
  widths: number[],
  opts: Omit<ImgOpts, "width"> = {},
): string {
  if (!src || !isProxyable(src) || widths.length === 0) return "";
  return widths
    .map((w) => `${optimizeImage(src, { ...opts, width: w })} ${w}w`)
    .join(", ");
}

/**
 * A tiny, heavily-blurred WebP suitable for an inline blur-up placeholder.
 * ~24px wide, q=30 — typically <1KB. Renders behind the real image until it
 * fires `load`. We avoid base64-encoding (would defeat HTTP caching across
 * repeat views of the same case).
 */
export function lqipUrl(src: string): string {
  if (!src || !isProxyable(src)) return src;
  return optimizeImage(src, { width: 24, quality: 30 });
}

/**
 * Sensible default width ladder for a CSS-px render width.
 * Covers DPR 1, 2, 3 without sending more than is needed.
 *
 * Example: a card rendered at ~280 CSS px on mobile (100vw on a 360px-wide
 * viewport with two columns) needs widths up to ~840 physical px, so
 * `responsiveWidths(280)` returns [280, 420, 560, 840].
 */
export function responsiveWidths(cssWidth: number): number[] {
  const w = Math.round(cssWidth);
  // Cap at 1600 — beyond that the proxy gives diminishing returns and the
  // origin becomes the bottleneck.
  return Array.from(
    new Set([w, Math.round(w * 1.5), w * 2, Math.min(w * 3, 1600)]),
  ).sort((a, b) => a - b);
}
