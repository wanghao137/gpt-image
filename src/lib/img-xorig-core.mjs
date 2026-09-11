/**
 * X(Twitter)-original routing for YouMind-hosted case images.
 *
 * Why this exists (2026-09 sharpness fix, see IMAGE_SHARPNESS_FIX_PLAN.md):
 *   98.4% of cases hot-link cms-assets.youmind.com, which re-encodes every
 *   asset at a hard 1200px long edge. The page displays far larger (lightbox
 *   96vw @DPR2 ≈ 2765 physical px; mobile cards ~1074px), so the browser
 *   upscales and the gallery looks blurry. Measured fill rates (real pixels
 *   ÷ (CSS × DPR)): lightbox 32% @DPR2, mobile cards 65–77%.
 *
 * The unlock: every YouMind filename embeds the original X media key —
 * verified 17,363/17,363 — e.g.
 *   .../1788942288291_1ovagz_HRu3ie-bwAATJ-v.jpg
 *     → https://pbs.twimg.com/media/HRu3ie-bwAATJ-v?format=jpg&name=orig
 * `name=orig` returns the untouched upload: 1.17–3.41× more pixels than the
 * YouMind copy (median ~1.28×; sampled 20/20 keys alive via wsrv relay).
 *
 * Availability: X intermittently 404s wsrv.nl's shared egress IPs (soft ban,
 * self-heals in minutes; deleted tweets 404 forever). wsrv's `errorredirect`
 * param 302s server-side to a fallback URL when the upstream fetch fails —
 * verified working — so every primary X URL carries a YouMind fallback that
 * reproduces exactly today's quality. The chain is never worse than the
 * status quo, it just costs one extra redirect during an X outage window.
 *
 * Everything still flows through wsrv.nl (WebP transcode + CN reachability);
 * we only swap WHICH upstream wsrv fetches. Plain .mjs so node --test can
 * exercise the URL math directly (see img-xorig-core.test.mjs).
 */

/** cms-assets.youmind.com/media/<timestamp>_<rand>_<X media key>.<ext> */
export const YOUMIND_X_MEDIA_RE =
  /^https?:\/\/cms-assets\.youmind\.com\/media\/\d+_[A-Za-z0-9]+_([A-Za-z0-9_-]{12,18})\.(jpe?g|png|webp)$/i;

export const WSRV_BASE = "https://wsrv.nl/";

/**
 * Map a YouMind URL to its original X upload, or null when `src` is not a
 * YouMind media URL with an embedded key (callers keep the legacy path).
 */
export function xOriginalUrl(src) {
  const m = typeof src === "string" ? src.match(YOUMIND_X_MEDIA_RE) : null;
  if (!m) return null;
  const ext = m[2].toLowerCase();
  // X canonicalises jpeg→jpg in its format param; png/webp pass through.
  const format = ext === "jpeg" ? "jpg" : ext;
  return `https://pbs.twimg.com/media/${m[1]}?format=${format}&name=orig`;
}

function stripScheme(absoluteUrl) {
  return absoluteUrl.replace(/^https?:\/\//i, "");
}

/**
 * Build a wsrv transform URL. `innerUrl` is the upstream wsrv should fetch;
 * its own query string (?format=jpg&name=orig) survives URLSearchParams
 * encoding — verified against the live service.
 *
 * `we=1` (without enlargement) stays mandatory: wsrv must never upscale.
 * The fix is bigger sources, not interpolation.
 */
export function wsrvTransformUrl(innerUrl, { width, quality = 78, format = "webp" } = {}) {
  const params = new URLSearchParams();
  params.set("url", stripScheme(innerUrl));
  params.set("w", String(Math.max(1, Math.round(width))));
  params.set("output", format);
  params.set("q", String(quality));
  params.set("we", "1");
  params.set("il", "1");
  return WSRV_BASE + "?" + params.toString();
}

/** wsrv passthrough — original bytes, no resize, no transcode. */
export function wsrvPassthroughUrl(absoluteUrl) {
  return WSRV_BASE + "?url=" + encodeURIComponent(stripScheme(absoluteUrl));
}

/**
 * Server-side fallback chain: wsrv 302s to `fallbackUrl` when its fetch of
 * the primary URL 404s. `primaryUrl` must already contain a query string
 * (both wsrv builders above do). The whole fallback URL is encoded, so its
 * own & separators never leak into the outer query.
 */
export function withErrorRedirect(primaryUrl, fallbackUrl) {
  return primaryUrl + "&errorredirect=" + encodeURIComponent(fallbackUrl);
}

/**
 * Full chain for one display width: X original first, YouMind copy as the
 * server-side fallback. Returns the legacy single-origin URL for anything
 * that isn't a YouMind media URL.
 */
export function xOrigWsrvTransformUrl(absoluteUrl, opts) {
  const xOrig = xOriginalUrl(absoluteUrl);
  if (!xOrig) return wsrvTransformUrl(absoluteUrl, opts);
  return withErrorRedirect(
    wsrvTransformUrl(xOrig, opts),
    wsrvTransformUrl(absoluteUrl, opts),
  );
}
