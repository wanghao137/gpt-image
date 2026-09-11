import { absoluteUrl, clipText, jsonLdSafeStringify } from "../src/lib/seo-url.mjs";
import { SITE_URL } from "./build-sitemap-core.mjs";
import { withErrorRedirect, wsrvPassthroughUrl, xOriginalUrl } from "../src/lib/img-xorig-core.mjs";

export { SITE_URL };

/**
 * og:image for one case row. YouMind media URLs get the same X-original
 * treatment as runtime images (see img-xorig-core.mjs): the raw upload is
 * 1.2–3.4× larger than YouMind's 1200px re-encode, and wsrv `errorredirect`
 * 302s to the YouMind copy server-side when X 404s. Foreign scrapers reach
 * both wsrv and pbs.twimg.com fine. Any other URL passes through untouched
 * (relative paths are absolutised by absoluteUrl).
 */
function caseOgImage(row, siteUrl) {
  const raw = String(row?.imageUrl ?? "");
  if (!raw) return "";
  const abs = absoluteUrl(siteUrl, raw);
  if (!/^https?:\/\/cms-assets\.youmind\.com\//i.test(abs)) return abs;
  const xOrig = xOriginalUrl(abs);
  return xOrig
    ? withErrorRedirect(wsrvPassthroughUrl(xOrig), wsrvPassthroughUrl(abs))
    : wsrvPassthroughUrl(abs);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

const HEAD_SUFFIX = "\n  </head>";
const ROOT_ANCHOR = '<div id="root"></div>';

/**
 * Build a crawlable variant of the SPA shell for one case: identical body
 * bootstrap, enriched <head>, plus a <noscript> content summary so the
 * page's unique text exists without JS execution.
 * Returns null for rows that cannot produce a sane page.
 */
export function buildCaseMetaHtml({ spaHtml, row, siteUrl = SITE_URL }) {
  const slug = String(row?.slug ?? "").trim();
  const title = String(row?.title ?? "").trim();
  if (!slug || !title) return null;

  const pageUrl = `${siteUrl}/case/${slug}`;
  const description =
    clipText(String(row?.promptPreview ?? "").replace(/\s+/g, " ").trim(), 150) ||
    `${title} — GPT-Image 提示词案例`;
  const ogImage = caseOgImage(row, siteUrl);
  const createdAt = String(row?.createdAt ?? "").slice(0, 10);

  const jsonLd = jsonLdSafeStringify({
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: title,
    description,
    url: pageUrl,
    ...(ogImage ? { contentUrl: ogImage } : {}),
    ...(createdAt ? { datePublished: createdAt } : {}),
  });

  const headTags = [
    `<title>${escapeHtml(title)} | 桃子AI视觉实验室</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`,
    '<meta property="og:type" content="article" />',
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    ...(ogImage
      ? [`<meta property="og:image" content="${escapeHtml(ogImage)}" />`]
      : []),
    `<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}" />`,
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join("\n    ");

  if (!spaHtml.includes("</head>") || !spaHtml.includes(ROOT_ANCHOR)) {
    throw new Error("spa shell is missing </head> or #root anchor — template drift");
  }

  return spaHtml
    .replace("</head>", () => `${headTags}${HEAD_SUFFIX}`)
    .replace(ROOT_ANCHOR, () => `${ROOT_ANCHOR}\n    <noscript><p>${escapeHtml(description)}</p></noscript>`);
}
