/**
 * Pure SEO URL + dimension helpers, shared by `SEO.tsx` and page components.
 *
 * Kept as a framework-free `.mjs` module so it can be unit-tested with
 * `node --test` (see `seo-url.test.mjs`) without pulling in React / JSDOM.
 *
 * Why this exists:
 *   Social scrapers (WeChat / Twitter / Facebook / Feishu) require an
 *   ABSOLUTE `og:image` / `twitter:image`. They do not resolve relative
 *   paths against the page URL the way a browser does — a relative
 *   `/images/case123.jpg` is silently dropped, producing an image-less
 *   share card. Every case detail page used to emit exactly that, so the
 *   site's primary virality surface (小红书 / 微信 share) was broken.
 */

/**
 * Resolve a path or URL to an absolute URL against `siteUrl`.
 *
 *   absoluteUrl("https://x.com", "https://cdn/y.jpg") → "https://cdn/y.jpg"
 *   absoluteUrl("https://x.com", "/images/a.jpg")     → "https://x.com/images/a.jpg"
 *   absoluteUrl("https://x.com/", "images/a.jpg")     → "https://x.com/images/a.jpg"
 *   absoluteUrl("https://x.com", "")                  → ""
 */
export function absoluteUrl(siteUrl, pathOrUrl) {
  const value = String(pathOrUrl ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:/i.test(value)) return value;
  const base = String(siteUrl ?? "").replace(/\/+$/, "");
  const rel = value.startsWith("/") ? value : `/${value}`;
  return `${base}${rel}`;
}

/**
 * Parse a ratio string like "9:16" into [w, h]. Tolerates "16:9", "4 : 5",
 * "3／4" etc. Returns null when it can't parse two positive numbers.
 */
export function parseRatio(ratio) {
  if (!ratio) return null;
  const m = String(ratio)
    .replace(/[／/]/g, ":")
    .match(/(\d+(?:\.\d+)?)\s*[:×x]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return [w, h];
}

/**
 * Compute integer image dimensions for structured data (schema.org
 * ImageObject) from a ratio string and a canonical render width.
 *
 * Falls back to a 4:5 portrait shape (the dataset's most common ratio)
 * when the ratio can't be parsed, so we never emit NaN / 0 dimensions.
 */
export function imageDimensionsForRatio(ratio, width = 1200) {
  const parsed = parseRatio(ratio) ?? [4, 5];
  const [w, h] = parsed;
  const safeWidth = Number.isFinite(width) && width > 0 ? Math.round(width) : 1200;
  const height = Math.round((safeWidth * h) / w);
  return { width: safeWidth, height };
}

/**
 * Collapse whitespace and hard-truncate with an ellipsis. Mirrors the old
 * migrate-v2 `clip()` so derived SEO descriptions match what used to be baked
 * into the dataset.
 */
export function clipText(value, max) {
  if (!value) return "";
  const flat = String(value).replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, Math.max(0, max - 1)) + "…";
}

/**
 * Serialize a value to a JSON string that is SAFE to embed inside an inline
 * `<script type="application/ld+json">` tag.
 *
 * `JSON.stringify` does NOT escape `<`, `>` or `&`, so a field containing the
 * literal `</script>` (these fields flow from third-party upstream sync AND
 * admin/Hermes input — NOT trusted local data) would close the script element
 * and allow arbitrary markup/script injection (stored XSS). We escape the
 * characters that matter for HTML/script-context breakouts using unicode
 * escapes, which are still valid JSON and parse back to the identical value.
 */
export function jsonLdSafeStringify(data) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    // U+2028 / U+2029 are valid in JSON strings but break inline scripts in
    // some engines; escape them too.
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Derive a case's `seoTitle` + `seoDescription` from its content.
 *
 * WHY DERIVE INSTEAD OF STORE
 *   These two fields used to be persisted into `public/data/cases.json` by
 *   migrate-v2. They are 100% a function of (title, promptPreview, category
 *   label) and added ~160 KB raw (~10 KB gzip) to the data chunk that EVERY
 *   page downloads — pure redundancy. We now compute them here. On the SSG'd
 *   detail page the result is rendered into the static HTML at build time, so
 *   crawlers still see the full strings; the client just recomputes the same
 *   value on hydration.
 *
 * `categoryLabel` is the user-facing bucket label (e.g. "人像写真"); callers
 * pass it in so this module stays free of the category table.
 */
export function deriveCaseSeo(promptCase, categoryLabel) {
  const title = String(promptCase?.title ?? "").trim();
  const label = categoryLabel || "GPT-Image 2";
  const seoTitle = `${title} · GPT-Image 2 Prompt 案例 | ${label}`;
  const head = clipText(promptCase?.promptPreview || title, 110);
  const seoDescription = `${head}—— 中英双语 Prompt，一键复制，快速复用。`;
  return { seoTitle, seoDescription };
}
