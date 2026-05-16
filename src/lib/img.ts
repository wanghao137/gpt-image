/**
 * Image optimization helpers.
 *
 * We route remote images through wsrv.nl (images.weserv.nl) — a free,
 * Cloudflare-backed proxy that resizes on the fly and serves WebP. This
 * massively reduces mobile payload without us needing our own CDN.
 *
 * Strategy:
 *  - `optimizeImage(url, { width })` → returns a single WebP URL at the target width.
 *  - `srcSetFor(url, [w, ...])`      → returns a `srcset` string for responsive `<img>`.
 *  - Falls back to the original URL when proxying isn't safe (data:, blob:, relative).
 *  - On runtime error, components should fall back to the original URL (see SmartImg).
 */

const PROXY = "https://wsrv.nl/";

export interface ImgOpts {
  /** Render width in CSS pixels; the proxy delivers at this exact width. */
  width: number;
  /** 0–100. Defaults to 78 — visually lossless for our use case. */
  quality?: number;
}

function isProxyable(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/** Returns a proxied/optimized image URL. Returns the input unchanged when proxying isn't safe. */
export function optimizeImage(src: string, opts: ImgOpts): string {
  if (!src || !isProxyable(src)) return src;
  const params = new URLSearchParams();
  // wsrv accepts the url without scheme — keeps the query string short.
  params.set("url", src.replace(/^https?:\/\//i, ""));
  params.set("w", String(Math.round(opts.width)));
  params.set("output", "webp");
  params.set("q", String(opts.quality ?? 78));
  // `we=1` = no enlargement past source size; avoids wasted bytes for small originals.
  params.set("we", "1");
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
