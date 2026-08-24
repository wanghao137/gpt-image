import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const SITE_URL = "https://taostudioai.com";

export const USER_CATEGORY_SLUGS = [
  "xhs-cover",
  "merchant-poster",
  "portrait",
  "kids-portrait",
  "3d-ip",
  "ecommerce",
  "travel-poster",
  "brand-kv",
  "festival",
  "infographic",
  "sticker",
  "wechat-grid",
  "ui-screenshot",
  "poster-general",
  "illustration",
  "classical",
  "storyboard",
  "architecture",
  "other",
];

export const STATIC_PATHS = [
  { path: "/", priority: "1.0" },
  { path: "/cases", priority: "0.9" },
  { path: "/templates", priority: "0.8" },
  { path: "/about", priority: "0.5" },
  { path: "/sitemap", priority: "0.5" },
];

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}

function normalizeSiteUrl(siteUrl) {
  return String(siteUrl || SITE_URL).replace(/\/+$/, "");
}

function urlEntry({ loc, lastmod, priority, changefreq = "weekly", siteUrl }) {
  const fullUrl = `${normalizeSiteUrl(siteUrl)}${loc}`;
  return [
    "  <url>",
    `    <loc>${escapeXml(fullUrl)}</loc>`,
    `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
    `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
    `    <priority>${escapeXml(priority)}</priority>`,
    "  </url>",
  ].join("\n");
}

function caseMatchesCategory(item, slug) {
  if (item?.userCategory === slug) return true;
  return Array.isArray(item?.userCategories) && item.userCategories.includes(slug);
}

/** Slugs that actually have a prerendered page: dist/<segment>/<slug>/index.html or .html. */
function collectPrerendered(distDir, segment) {
  const slugs = new Set();
  const dir = resolve(distDir, segment);
  if (!existsSync(dir)) return slugs;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) slugs.add(entry.name);
    else if (entry.isFile() && entry.name.endsWith(".html")) {
      slugs.add(entry.name.replace(/\.html$/, ""));
    }
  }
  return slugs;
}

function createSitemapEntries({ cases, today, siteUrl }, distDir) {
  const sourceCases = Array.isArray(cases) ? cases : [];
  // A distDir path that does not exist on disk counts as "no dist": fall back
  // to the static category table instead of scanning an empty tree.
  const hasPrerenderedDist = Boolean(distDir) && existsSync(distDir);
  const entries = [];

  for (const item of STATIC_PATHS) {
    entries.push(urlEntry({ loc: item.path, lastmod: today, priority: item.priority, siteUrl }));
  }

  // Invariant: sitemap lists exactly the URLs that ship as real pages. When
  // dist exists we scan it (single source of truth); otherwise fall back to
  // the static category table and omit templates rather than guess.
  const prerenderedCategories = hasPrerenderedDist
    ? collectPrerendered(distDir, "category")
    : null;
  if (prerenderedCategories) {
    for (const slug of [...prerenderedCategories].sort()) {
      entries.push(urlEntry({ loc: `/category/${slug}`, lastmod: today, priority: "0.8", siteUrl }));
    }
  } else {
    for (const slug of USER_CATEGORY_SLUGS) {
      if (!sourceCases.some((item) => caseMatchesCategory(item, slug))) continue;
      entries.push(urlEntry({ loc: `/category/${slug}`, lastmod: today, priority: "0.8", siteUrl }));
    }
  }

  if (hasPrerenderedDist) {
    const templates = collectPrerendered(distDir, "template");
    for (const id of [...templates].sort()) {
      entries.push(urlEntry({ loc: `/template/${id}`, lastmod: today, priority: "0.7", siteUrl }));
    }
  }

  for (const item of sourceCases) {
    if (!item?.slug) continue;
    const lastmod = String(item.createdAt || today).slice(0, 10);
    entries.push(urlEntry({ loc: `/case/${item.slug}`, lastmod, priority: "0.6", siteUrl }));
  }

  return entries;
}

export function generateSitemapXml({
  cases,
  today = new Date().toISOString().slice(0, 10),
  siteUrl = SITE_URL,
  distDir,
} = {}) {
  const entries = createSitemapEntries({ cases, today, siteUrl }, distDir);

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

export function buildSitemap({
  root = process.cwd(),
  publicDir = resolve(root, "public"),
  distDir = resolve(root, "dist"),
  today = new Date().toISOString().slice(0, 10),
  siteUrl = SITE_URL,
  // Vercel re-invokes the build command several times per deployment, and a
  // build that mutates public/ (an input tree) re-triggers it while the
  // previous pass's output is still being streamed — the resulting
  // delete-vs-read race crashed deploys with ENOENT on random public images.
  // CI therefore writes dist-only; local dev keeps the public/ copy so
  // `vite dev` can serve /sitemap.xml before any build exists.
  alsoWritePublic = !process.env.VERCEL,
} = {}) {
  const casesPath = resolve(publicDir, "data", "cases.json");
  const cases = JSON.parse(readFileSync(casesPath, "utf8"));
  const xml = generateSitemapXml({ cases, today, siteUrl, distDir });
  const urls = createSitemapEntries({ cases, today, siteUrl }, distDir).length;
  const written = [];

  if (alsoWritePublic) {
    mkdirSync(publicDir, { recursive: true });
    const publicPath = resolve(publicDir, "sitemap.xml");
    writeFileSync(publicPath, xml, "utf8");
    written.push(publicPath);
  }

  if (existsSync(distDir)) {
    const distPath = resolve(distDir, "sitemap.xml");
    writeFileSync(distPath, xml, "utf8");
    written.push(distPath);
  }

  return { urls, written };
}
