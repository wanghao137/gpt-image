/**
 * Image URL builders.
 *
 * The `scripts/build-images.mjs` step during `prebuild` downloads every
 * upstream image once and emits multiple variants under `public/images/`:
 *
 *   case123.jpg          ← 1200 px JPEG (canonical / fallback / OG card)
 *   case123-320.webp     ← responsive WebP variants (default 320/480/640/960)
 *   case123-480.webp
 *   case123-640.webp
 *   case123-960.webp
 *
 * cases.json's `imageUrl` always points at the canonical .jpg path, so
 * existing callers don't need to know about variants. The helpers below
 * derive variant filenames on demand for callers that want to build a
 * srcset / <picture> source set.
 *
 * Net effect at runtime: every <img> the page generates points at
 * /images/<file> on the same origin as the HTML — same edge POP, same
 * TLS connection, no third-party CDNs. wsrv is kept as a defensive
 * fallback only for URLs the build pipeline somehow missed.
 */

const WSRV = "https://wsrv.nl/";
const SITE_ORIGIN =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://taostudioai.com";

/**
 * Available WebP variant widths on disk. Must match
 * scripts/build-images.mjs IMAGE_VARIANTS default. Keeping it as a literal
 * here (rather than reading at runtime) lets the bundler tree-shake and
 * avoids a fetch round-trip just to discover what's available.
 *
 * If you change this list, also bump scripts/build-images.mjs and rerun
 * `node scripts/build-images.mjs --force`.
 */
export const LOCAL_WEBP_WIDTHS = [320, 480, 640, 960] as const;

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
 * CDN hosts we trust to serve images directly (no wsrv proxy). These are
 * globally distributed CDNs that are fast enough on their own — proxying
 * through wsrv just adds a hop and a single point of failure.
 */
const DIRECT_CDN_HOSTS = ["cms-assets.youmind.com"];

function isDirectCdn(src: string): boolean {
  try {
    const host = new URL(src).hostname;
    return DIRECT_CDN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Default image URL. Identity for local /images/* paths, /assets/* Vite
 * bundles, and trusted CDN hosts. Anything else goes through wsrv as a
 * runtime safety net.
 */
export function transformUrl(src: string, opts: ImgOpts): string {
  if (!src) return src;
  if (isLocalImage(src)) return src;
  if (src.startsWith("/assets/")) return src;
  if (isDirectCdn(src)) return src;
  return rawTransformUrl(src, opts);
}

/**
 * wsrv.nl direct URL. Only used for:
 *   - OG card images in SEO meta (scraped by Twitter/FB/WeChat from
 *     non-CN IPs, so wsrv's North-American POPs are fine for them)
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

// ─────────────────────────────────────────── local variant helpers ──

/**
 * Strip the canonical `.jpg`/`.jpeg` extension to recover the base name
 * used by build-images.mjs when emitting variants. Returns `null` for
 * paths that aren't a local /images/<base>.jpg — callers should fall
 * back to the original src when this returns null.
 *
 * Example: `/images/case123.jpg` → `/images/case123`
 */
function localImageBase(src: string): string | null {
  if (!isLocalImage(src)) return null;
  const m = src.match(/^(\/images\/[^/?#]+)\.(?:jpg|jpeg|png)$/i);
  return m ? m[1] : null;
}

/**
 * Build a same-origin WebP `srcset` for a local image. The `widths`
 * argument is a hint about the CSS pixel widths the caller will render
 * at — for each requested width we pick the smallest on-disk variant
 * that's `>=` it (capped at the largest variant), so callers don't need
 * to know the exact ladder.
 *
 * Why we round up rather than emit only exact matches:
 *   Call sites historically passed bespoke ladders like [280, 420, 560]
 *   tuned to specific CSS widths rather than to our build pipeline. If we
 *   only emitted srcset entries whose descriptor exactly matched a file
 *   on disk, those callers would silently fall back to the canonical
 *   1200 JPEG. By snapping each requested width up to the next available
 *   on-disk variant we always emit at least one descriptor per requested
 *   ladder rung, while still keeping the actual files served from a
 *   small fixed set.
 *
 * Returns "" for non-local images or when no variants apply (e.g. SVG
 * placeholders).
 */
export function localWebpSrcSet(src: string, widths?: readonly number[]): string {
  const base = localImageBase(src);
  if (!base) return "";
  const requested = widths && widths.length > 0 ? widths : LOCAL_WEBP_WIDTHS;
  const ladder = [...LOCAL_WEBP_WIDTHS].sort((a, b) => a - b);
  // For each requested CSS width, snap to the smallest available variant
  // ≥ that width. De-duplicate so a ladder like [280, 380, 540] doesn't
  // collapse to ["480w", "480w", "640w"] (only one 480 entry needed).
  const snapped = new Set<number>();
  for (const w of requested) {
    const pick = ladder.find((v) => v >= w) ?? ladder[ladder.length - 1];
    snapped.add(pick);
  }
  return [...snapped]
    .sort((a, b) => a - b)
    .map((w) => `${base}-${w}.webp ${w}w`)
    .join(", ");
}

/**
 * Build a same-origin JPEG `srcset` for a local image. Right now we only
 * have the canonical 1200 px JPEG on disk, so this returns a single-width
 * srcset. Kept as a separate helper so a future rev that emits multiple
 * JPEG widths only needs to update build-images.mjs + this function.
 *
 * This is the <img> fallback for browsers without WebP support. Since we
 * can't actually serve a smaller JPEG, the fallback is "download the
 * canonical 1200" — fine for the < 4% of long-tail browsers without WebP.
 */
export function localJpegSrcSet(src: string): string {
  if (!isLocalImage(src)) return "";
  return `${src} 1200w`;
}

/**
 * Pick the smallest local WebP variant ≥ `targetWidth`. Used as the
 * `<img src>` fallback inside a `<picture>` so the no-srcset path
 * (e.g. when JS fails to apply a srcset) still grabs a reasonably sized
 * file. Returns the canonical `src` unchanged for non-local images.
 */
export function pickLocalWebp(src: string, targetWidth: number): string {
  const base = localImageBase(src);
  if (!base) return src;
  const sorted = [...LOCAL_WEBP_WIDTHS].sort((a, b) => a - b);
  const chosen = sorted.find((w) => w >= targetWidth) ?? sorted[sorted.length - 1];
  return `${base}-${chosen}.webp`;
}
