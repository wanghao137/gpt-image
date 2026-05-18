/**
 * Image URL builders.
 *
 * Strategy (mobile-first, China-friendly):
 *
 *   PRIMARY  — `/img/<host>/<path>` is proxied by `functions/img/[[path]].ts`
 *              on Cloudflare Pages. CF caches the bytes at the edge, so each
 *              image is fetched from origin once globally and then served
 *              from a nearby POP (HKG / NRT / SIN for mainland China users)
 *              for the next year. This is the fast path and the only one
 *              that consistently breaks 1s LCP on Chinese mobile networks.
 *
 *   SECONDARY — wsrv.nl, the previous primary. Useful as a client-side
 *              fallback if the edge function is unreachable (rare — Pages
 *              Functions share fate with the static deployment) or as the
 *              transformation layer when we want a tiny LQIP variant.
 *
 *   TERTIARY  — the raw origin URL itself. Last-ditch fallback used by
 *              SmartImg when both proxies fail.
 *
 * `optimizeImage()` returns a URL the browser can fetch with no query-string
 * gymnastics on the consumer side. SmartImg's three-stage fallback handles
 * the failure flow.
 */

/**
 * The deployed site origin. wsrv.nl can only resize images that are
 * publicly reachable, so when we want to transform a *local* path
 * (`/uploads/<file>.png`) we have to give wsrv our own absolute URL —
 * wsrv then fetches it back, resizes, and our edge proxy caches the
 * result so the second hop is local-edge instead of wsrv.
 *
 * In SSR we don't have `window`; the build pre-renders to absolute URLs
 * via a hard-coded fallback that mirrors `SITE.url` in src/components/SEO.tsx.
 * The two strings must match the production deployment domain.
 */
const SITE_ORIGIN =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://gpt-image-6hu.pages.dev";

const WSRV = "https://wsrv.nl/";

export interface ImgOpts {
  /** Render width in CSS pixels. Used by the `wsrv` transform layer. */
  width: number;
  /** 0–100. Defaults to 78 — visually lossless for our use case. */
  quality?: number;
  /**
   * Output format. Defaults to "webp" because it's universally supported and
   * has predictable decoding cost.
   */
  format?: "webp" | "avif" | "auto";
}

/**
 * True for `http(s)://...` URLs. Edge proxy + transforms only make sense for
 * those; relative paths under our own deployment (e.g. `/uploads/...`) are
 * already served from CF Pages and need no further routing.
 */
function isProxyable(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/**
 * Promote a relative path (`/uploads/foo.png`) to an absolute URL on our own
 * deployment so wsrv can fetch it. Pass-through for anything that's already
 * absolute or empty.
 */
function absoluteUrl(src: string): string {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  // Treat as a path relative to the deployment root; preserve the query.
  if (src.startsWith("/")) return SITE_ORIGIN + src;
  return SITE_ORIGIN + "/" + src;
}

/**
 * Edge-proxy a remote image through `/img/<host>/<path>`. Returns the input
 * unchanged for relative paths (already on our origin) and for non-HTTP URLs
 * (data: / blob:).
 *
 * Why no transform params here:
 *   The Pages Function intentionally proxies bytes verbatim — adding
 *   transforms (resize, format conversion) would either need CF's paid
 *   Image Resizing or our own sharp-on-the-edge install. For now we rely on
 *   the browser's `srcset` to pick a width and let the original bytes flow
 *   through. The resulting payloads are still small because the upstream
 *   case images are already optimised for web (sub-300KB JPEGs).
 */
export function edgeProxyUrl(src: string): string {
  if (!src || !isProxyable(src)) return src;
  try {
    const u = new URL(src);
    // Strip the protocol; the Function reads `host` from the first path segment.
    return `/img/${u.host}${u.pathname}${u.search}`;
  } catch {
    return src;
  }
}

/**
 * Same edge-proxy wrap as `edgeProxyUrl`, but used internally to wrap a URL
 * that *already contains* a query string (notably wsrv.nl transform URLs).
 *
 * Behaviour: hostname becomes the first path segment, the original query
 * string is preserved verbatim. Both `/img/<host>/<path>?<query>` and
 * `/img/<host>/?<query>` are valid for the Function — `[[path]]` matches
 * empty path segments so wsrv URLs like `https://wsrv.nl/?url=...` work.
 */
function edgeProxyWrap(absoluteUrl: string): string {
  return edgeProxyUrl(absoluteUrl);
}

/**
 * Rewrite `raw.githubusercontent.com/<user>/<repo>/<branch>/<path>` to the
 * jsDelivr equivalent. NOTE: jsDelivr now 301-redirects this specific repo
 * back to raw.github, so the practical benefit has evaporated. We keep the
 * rewriter purely as a no-op-safe helper for SmartImg's fallback chain;
 * if jsDelivr starts mirroring again in the future this will silently
 * become useful again.
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

/**
 * Returns the URL that should be used as a *transform* request for a given
 * width.
 *
 * Routing: bytes flow through wsrv.nl for the actual resize, but the response
 * is wrapped through our own edge proxy so the resized output gets cached on
 * our CDN. Net effect: wsrv handles the heavy lifting once globally; every
 * subsequent request anywhere in the world hits a CF POP near the user.
 *
 * Local /uploads/<file> paths are promoted to absolute URLs against the
 * deployment origin before being handed to wsrv. This is critical: those
 * originals can be multi-megabyte PNGs straight from the admin uploader,
 * which would single-handedly destroy LCP on mobile if served as-is.
 */
export function transformUrl(src: string, opts: ImgOpts): string {
  if (!src) return src;
  return edgeProxyWrap(rawTransformUrl(src, opts));
}

/**
 * Direct wsrv URL with no edge wrapper. Used by SmartImg's stage 1 fallback
 * so that "edge proxy is broken" doesn't cascade into "transforms also
 * broken" — the wsrv direct path is genuinely independent of our deploy.
 */
/**
 * Direct wsrv URL with no edge wrapper. Used by SmartImg's stage 1 fallback
 * so that "edge proxy is broken" doesn't cascade into "transforms also
 * broken" — the wsrv direct path is genuinely independent of our deploy.
 *
 * Accepts both absolute (`http(s)://...`) and root-relative (`/uploads/...`)
 * URLs. Relative paths get promoted to absolute against the deployment
 * origin so wsrv can reach them — this is essential because uploaded
 * /uploads/<file>.png originals are routinely 2–5MB and *must* be resized
 * before they're sent to mobile devices.
 */
export function rawTransformUrl(src: string, opts: ImgOpts): string {
  if (!src) return src;
  const abs = absoluteUrl(src);
  if (!/^https?:\/\//i.test(abs)) return src; // data:, blob:, etc.
  const params = new URLSearchParams();
  params.set("url", abs.replace(/^https?:\/\//i, ""));
  params.set("w", String(Math.round(opts.width)));
  params.set("output", opts.format ?? "webp");
  params.set("q", String(opts.quality ?? 78));
  params.set("we", "1");
  params.set("il", "1");
  return WSRV + "?" + params.toString();
}

/**
 * Default image URL used by SmartImg.src.
 *
 * Goes through the edge proxy, which:
 *   - is fast in mainland China (HKG / NRT / SIN POPs),
 *   - delivers bytes verbatim (no CSS-px resizing — relies on browser srcset
 *     to choose an appropriate file).
 *
 * Callers that *need* a precise-width fetch (LQIP, hero featured grid) should
 * call `transformUrl()` directly.
 */
export function optimizeImage(src: string, _opts: ImgOpts): string {
  return edgeProxyUrl(src);
}

/**
 * Build a `srcset` string. Because the edge proxy returns the original bytes
 * regardless of `w`, all entries point at the same URL — but we still emit
 * the full `w` ladder so the browser can pick the largest one for DPR=3
 * devices. This is more bytes than ideal, but `<img>` only loads the chosen
 * candidate, so the cost is one full-size fetch per image.
 *
 * If we later add CF Image Resizing (paid) or sharp at the edge, this single
 * function is the only place that needs to switch to size-targeted URLs.
 */
export function srcSetFor(
  src: string,
  widths: number[],
  _opts: Omit<ImgOpts, "width"> = {},
): string {
  if (!src || !isProxyable(src) || widths.length === 0) return "";
  const proxied = edgeProxyUrl(src);
  return widths.map((w) => `${proxied} ${w}w`).join(", ");
}

/**
 * Tiny blurred placeholder used for inline blur-up. Goes through wsrv since
 * we explicitly need a *resize* down to ~24px; we use the raw direct path so
 * a non-functioning edge proxy doesn't take down LQIPs as well.
 *
 * Accepts local /uploads/* paths — those are promoted to absolute URLs in
 * `rawTransformUrl` so wsrv can fetch them.
 */
export function lqipUrl(src: string): string {
  if (!src) return src;
  return rawTransformUrl(src, { width: 24, quality: 30 });
}

/**
 * Sensible default width ladder for a given CSS-px render width.
 * Covers DPR 1, 2, 3 without sending more than is needed.
 */
export function responsiveWidths(cssWidth: number): number[] {
  const w = Math.round(cssWidth);
  return Array.from(
    new Set([w, Math.round(w * 1.5), w * 2, Math.min(w * 3, 1600)]),
  ).sort((a, b) => a - b);
}
