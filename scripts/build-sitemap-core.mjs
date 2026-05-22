import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

function createSitemapEntries({ cases, today, siteUrl }) {
  const sourceCases = Array.isArray(cases) ? cases : [];
  const entries = [];

  for (const item of STATIC_PATHS) {
    entries.push(urlEntry({ loc: item.path, lastmod: today, priority: item.priority, siteUrl }));
  }

  for (const slug of USER_CATEGORY_SLUGS) {
    if (!sourceCases.some((item) => caseMatchesCategory(item, slug))) continue;
    entries.push(urlEntry({ loc: `/category/${slug}`, lastmod: today, priority: "0.8", siteUrl }));
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
} = {}) {
  const entries = createSitemapEntries({ cases, today, siteUrl });

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
} = {}) {
  const casesPath = resolve(publicDir, "data", "cases.json");
  const cases = JSON.parse(readFileSync(casesPath, "utf8"));
  const xml = generateSitemapXml({ cases, today, siteUrl });
  const urls = createSitemapEntries({ cases, today, siteUrl }).length;
  const written = [];

  mkdirSync(publicDir, { recursive: true });
  const publicPath = resolve(publicDir, "sitemap.xml");
  writeFileSync(publicPath, xml, "utf8");
  written.push(publicPath);

  if (existsSync(distDir)) {
    const distPath = resolve(distDir, "sitemap.xml");
    writeFileSync(distPath, xml, "utf8");
    written.push(distPath);
  }

  return { urls, written };
}
