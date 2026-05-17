/**
 * Generate dist/sitemap.xml after the SSG build completes.
 *
 * Source of truth: `public/data/cases.json` + the in-code `USER_CATEGORIES`
 * list — we don't need to scan the filesystem.
 *
 * Run via npm script `postbuild`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SITE_URL = "https://gpt-image-6hu.pages.dev";
const ROOT = process.cwd();
const DIST = resolve(ROOT, "dist");

if (!existsSync(DIST)) {
  console.error("✗ dist/ does not exist — run vite build first");
  process.exit(1);
}

const cases = JSON.parse(
  readFileSync(resolve(ROOT, "public/data/cases.json"), "utf8"),
);

const USER_CATEGORY_SLUGS = [
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

const STATIC_PATHS = [
  { path: "/", priority: "1.0" },
  { path: "/cases", priority: "0.9" },
  { path: "/templates", priority: "0.8" },
  { path: "/guide", priority: "0.7" },
  { path: "/services", priority: "0.9" },
  { path: "/about", priority: "0.5" },
  { path: "/agents", priority: "0.5" },
];

const today = new Date().toISOString().slice(0, 10);

function urlEntry(loc, lastmod, priority, changefreq = "weekly") {
  return [
    "  <url>",
    `    <loc>${SITE_URL}${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}

const entries = [];

for (const s of STATIC_PATHS) {
  entries.push(urlEntry(s.path, today, s.priority));
}

for (const slug of USER_CATEGORY_SLUGS) {
  // Only emit slugs that produced an HTML page (with cases inside).
  const has = cases.some((c) => {
    const key = (c.userCategory || "").toString();
    return key === slug;
  });
  if (!has) continue;
  entries.push(urlEntry(`/category/${slug}`, today, "0.8"));
}

for (const c of cases) {
  if (!c.slug) continue;
  const lm = (c.createdAt || new Date().toISOString()).slice(0, 10);
  entries.push(urlEntry(`/case/${c.slug}`, lm, "0.6"));
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

writeFileSync(resolve(DIST, "sitemap.xml"), xml, "utf8");
console.log(`✓ wrote sitemap.xml — ${entries.length} URLs`);
