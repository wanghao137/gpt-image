/**
 * Image URL builders.
 *
 * Strategy (mobile-first, China-friendly):
 *
 *   /uploads/<file>          — uploaded by the admin. Mirrored to Tencent
 *                              Cloud COS (Hong Kong region). Public requests
 *                              go to `${COS_HOST}/uploads/<file>?imageMogr2/...`,
 *                              which is <100ms RTT from CN telecom/unicom/
 *                              mobile (vs ~700ms to CF Pages free-tier US/JP
 *                              POPs) and supports on-the-fly WebP resize via
 *                              URL params. THIS is the path that fixed the
 *                              "image won't load on mobile" report.
 *
 *   external http(s) URLs    — case dataset references on raw.github /
 *                              jsdelivr. We route those through wsrv.nl for
 *                              WebP resize. Slower than COS but origin is
 *                              already a sunk cost.
 *
 *   /assets/<hash>.<ext>     — Vite-hashed bundles. Already optimised, served
 *                              direct from CF Pages. No transform layer.
 *
 * Public env (read at build/runtime via Vite's `import.meta.env`):
 *   VITE_COS_HOST    — full hostname, optional (overrides bucket+region)
 *   VITE_COS_BUCKET  — bucket id with appid suffix
 *   VITE_COS_REGION  — region slug, e.g. "ap-hongkong"
 *
 * If none are set we fall back to wsrv-via-our-own-origin for /uploads,
 * which is the legacy path. That keeps local dev working before COS is
 * configured.
 */

const WSRV = "https://wsrv.nl/";

/**
 * Resolved COS hostname (no protocol, no trailing slash). Empty string
 * means "no COS configured; fall back to wsrv pulling from our origin".
 *
 * We hard-code the production bucket as the default so the site works on
 * Cloudflare Pages without manual env var configuration. Override via
 * VITE_COS_HOST or VITE_COS_BUCKET+VITE_COS_REGION when you need to point
 * at a staging bucket or a custom CDN domain.
 */
const COS_HOST = (() => {
  // Vite exposes `import.meta.env.VITE_*` to the browser bundle and to SSR.
  // Wrap in try/catch in case this module is loaded outside a Vite context
  // (e.g. unit tests).
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
    if (env.VITE_COS_HOST) return env.VITE_COS_HOST.trim();
    const bucket = env.VITE_COS_BUCKET?.trim();
    const region = env.VITE_COS_REGION?.trim();
    if (bucket && region) return `${bucket}.cos.${region}.myqcloud.com`;
  } catch {
    /* not running under Vite — fall through to default */
  }
  // Production default. Mirrors the bucket we provisioned in Tencent Cloud.
  return "gpt-image-2-1259488227.cos.ap-hongkong.myqcloud.com";
})();

/**
 * The deployed site origin. Used as a base for relative paths when we have
 * to tell wsrv to fetch them — wsrv only takes absolute URLs.
 *
 * In SSR we don't have `window`; we hard-code the production domain. The
 * value must match `SITE.url` in src/components/SEO.tsx.
 */
const SITE_ORIGIN =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://gpt-image-6hu.pages.dev";

export interface ImgOpts {
  /** Render width in CSS pixels. */
  width: number;
  /** 0–100. Defaults to 78 — visually lossless for our use case. */
  quality?: number;
  /**
   * Output format. Defaults to "webp" because it's universally supported and
   * has predictable decoding cost.
   */
  format?: "webp" | "avif" | "auto";
}

function isHttp(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/**
 * True for paths under `/uploads/` (case-insensitive). These are admin
 * uploads, mirrored to COS by `scripts/upload-cos.mjs`. Anything else
 * relative is left alone.
 */
function isUploadsPath(src: string): boolean {
  return /^\/uploads\//i.test(src);
}

/**
 * True for paths under `/assets/` (Vite-hashed bundles). Those are already
 * optimised and bypass every transform layer.
 */
function isAssetPath(src: string): boolean {
  return /^\/assets\//i.test(src);
}

/**
 * Build a Tencent Cloud COS `imageMogr2` query string for the given options.
 * Reference: https://cloud.tencent.com/document/product/436/44880
 *
 * The pipeline we want:
 *   - thumbnail/<W>x  → resize to width W, height auto, do not upscale
 *   - format/webp     → server-side transcode to WebP (huge win for PNGs)
 *   - quality/<Q>     → JPEG/WebP quality target
 *
 * Order matters in imageMogr2 pipelines: format must come AFTER thumbnail
 * so the resize happens on the larger source then we encode the smaller
 * frame as WebP.
 */
function cosImageQuery(opts: ImgOpts): string {
  const w = Math.max(1, Math.round(opts.width));
  const q = Math.max(1, Math.min(100, opts.quality ?? 78));
  const fmt = opts.format ?? "webp";
  // `thumbnail/!Wx` would force enlarge; plain `Wx` keeps source bounds and
  // crops if necessary. We use `Wx` (no `!`, no `>`) which is "fit width,
  // height auto". Add `/ignore-error/1` so missing-extension files don't 400.
  return `imageMogr2/thumbnail/${w}x/format/${fmt}/quality/${q}/ignore-error/1`;
}

/**
 * Promote a relative path to an absolute URL on our deployment, or pass
 * through anything that's already absolute. Does NOT touch the path beyond
 * resolving relative-to-root.
 */
function absoluteUrl(src: string): string {
  if (!src) return src;
  if (isHttp(src)) return src;
  if (src.startsWith("/")) return SITE_ORIGIN + src;
  return SITE_ORIGIN + "/" + src;
}

/**
 * Returns the URL the browser should fetch for a *resized* version of `src`.
 *
 * Routing:
 *   /uploads/<file> + COS configured  → `${COS_HOST}/uploads/<file>?imageMogr2/...`
 *                                       (China-friendly, single hop)
 *   /uploads/<file> + no COS host     → wsrv.nl resize of the absolute URL
 *                                       (legacy local-dev path)
 *   /assets/<file>                    → return verbatim (already optimised)
 *   absolute http(s)                  → wsrv.nl resize of the URL
 *   anything else                     → return verbatim (data:, blob:, etc.)
 */
export function transformUrl(src: string, opts: ImgOpts): string {
  if (!src) return src;
  if (isAssetPath(src)) return src;

  if (isUploadsPath(src) && COS_HOST) {
    // COS keys are POSIX paths without a leading slash.
    const key = src.replace(/^\/+/, "");
    return `https://${COS_HOST}/${key}?${cosImageQuery(opts)}`;
  }

  // Fallback / external URLs → wsrv resize.
  return rawTransformUrl(src, opts);
}

/**
 * Direct wsrv.nl URL with no edge wrapper. Used by SmartImg's stage-1
 * fallback when an /uploads file is configured for COS but the user's
 * network can't reach COS for some reason.
 *
 * Accepts both absolute and root-relative URLs; relative paths get promoted
 * to absolute against the deployment origin so wsrv can fetch them.
 */
export function rawTransformUrl(src: string, opts: ImgOpts): string {
  if (!src) return src;
  const abs = absoluteUrl(src);
  if (!isHttp(abs)) return src; // data:, blob:, etc.
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
 * Tiny blurred placeholder used for inline blur-up. ~24 px wide.
 * Routes through the same `transformUrl` ladder so /uploads images get
 * their LQIP from COS (single hop) too.
 */
export function lqipUrl(src: string): string {
  if (!src) return src;
  if (isAssetPath(src)) return src;
  return transformUrl(src, { width: 24, quality: 30 });
}

/**
 * Default image URL — kept for backward compatibility with existing call
 * sites that don't care about width-targeting. Goes through `transformUrl`
 * with a generous 1200w cap so the worst case is "slightly oversized for
 * the actual render box" rather than "blurry".
 */
export function optimizeImage(src: string, opts: ImgOpts): string {
  return transformUrl(src, opts);
}

/**
 * Build a `srcset` string covering the supplied widths.
 */
export function srcSetFor(
  src: string,
  widths: number[],
  opts: Omit<ImgOpts, "width"> = {},
): string {
  if (!src || widths.length === 0) return "";
  return widths
    .map((w) => `${transformUrl(src, { ...opts, width: w })} ${w}w`)
    .join(", ");
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
