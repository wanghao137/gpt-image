/**
 * Lab shard generator — runs AFTER data/manual/lab.json is updated by
 * scripts/import-lab.mjs. Mirrors the split-data.mjs philosophy: the client
 * bundle NEVER imports the full registry; every page loads only the shard(s)
 * it needs.
 *
 *   public/data/lab-home.json       — first 48 lite rows + counts + revision.
 *                                      Statically importable in BOTH SSG and
 *                                      client builds (mirrors cases-home.json).
 *   public/data/lab/browse/         — page-000..N.json, 48 lite rows/page,
 *                                      newest first. page-000 == lab-home.items.
 *   public/data/lab-index.json      — [{id,slug}] for SPA route lookup.
 *   public/data/lab/prompts/        — <slug>.json full item (minus hidden) +
 *                                      detail/lightbox URLs. Fetched only when
 *                                      a user SPA-navigates onto a detail page.
 *
 * Hidden entries (hidden: true) are excluded from every public artifact.
 * A missing/empty lab.json is NOT an error — fresh clones build fine with an
 * empty lab section.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { labImageUrl, labOriginalUrl } from "../src/lib/lab-cos-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LAB_JSON = resolve(ROOT, "data/manual/lab.json");
const DATA_DIR = resolve(ROOT, "public/data");
const LAB_IMAGES_DIR = resolve(ROOT, "public/lab-images");

const PAGE_SIZE = 48;
const CARD_W = 480;
const DETAIL_W = 1600;

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data), "utf8");
}

/**
 * Per-entry image URLs. Browse-grade variants are served same-origin from
 * public/lab-images/ (baked by build-lab-web-images.mjs, free Vercel
 * bandwidth — COS egress became ¥1/day under bot traffic, 2026-08-30).
 * When a baked file is missing the entry falls back to its COS imageMogr2
 * URL so a partial bake can never break the page. `orig` stays a COS
 * direct link (download button — the only path that should cost COS
 * traffic).
 */
function labUrls(item) {
  const card = resolve(LAB_IMAGES_DIR, `${item.id}-${CARD_W}.webp`);
  const detail = resolve(LAB_IMAGES_DIR, `${item.id}-${DETAIL_W}.webp`);
  const thumb = existsSync(card) ? `/lab-images/${item.id}-${CARD_W}.webp` : labImageUrl(item.cosKey, 640);
  const detailUrl = existsSync(detail)
    ? `/lab-images/${item.id}-${DETAIL_W}.webp`
    : labImageUrl(item.cosKey, DETAIL_W, 82);
  return {
    thumb,
    detail: detailUrl,
    lightbox: detailUrl,
    og: detailUrl,
    orig: labOriginalUrl(item.cosKey),
  };
}

function toLite(item) {
  return {
    id: item.id,
    slug: item.slug,
    t: item.title,
    d: item.createdAt,
    w: item.width,
    h: item.height,
    thumb: labUrls(item).thumb,
  };
}

/**
 * Pure shard builder (exported for tests).
 * @returns {{ home: object, pages: array, index: array, prompts: object }}
 */
export function buildLabShards(items) {
  const visible = (Array.isArray(items) ? items : [])
    .filter((i) => i && !i.hidden)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); // newest first
  const revision = createHash("sha256").update(JSON.stringify(visible)).digest("hex").slice(0, 12);

  const liteRows = visible.map(toLite);
  const pages = [];
  for (let i = 0; i < liteRows.length; i += PAGE_SIZE) {
    pages.push(liteRows.slice(i, i + PAGE_SIZE));
  }

  const prompts = {};
  const urls = {};
  visible.forEach((item, idx) => {
    const { hidden: _hidden, ...rest } = item;
    const u = labUrls(item);
    // prev = newer neighbour (one row above), next = older. Baked into the
    // shard so SPA navigation has prev/next without loading the registry.
    prompts[item.slug] = {
      ...rest,
      detail: u.detail,
      lightbox: u.lightbox,
      orig: u.orig,
      prev: idx > 0 ? { slug: visible[idx - 1].slug, t: visible[idx - 1].title } : null,
      next: idx < visible.length - 1 ? { slug: visible[idx + 1].slug, t: visible[idx + 1].title } : null,
    };
    urls[item.slug] = u;
  });

  return {
    home: {
      items: liteRows.slice(0, PAGE_SIZE),
      totalCount: liteRows.length,
      pageCount: pages.length,
      pageSize: PAGE_SIZE,
      revision,
    },
    pages,
    index: visible.map((i) => ({ id: i.id, slug: i.slug })),
    prompts,
    urls,
  };
}

function main() {
  if (!existsSync(LAB_JSON)) {
    console.log("lab: data/manual/lab.json 不存在，写空集分片。");
  }
  const items = existsSync(LAB_JSON)
    ? JSON.parse(readFileSync(LAB_JSON, "utf8"))
    : [];
  const { home, pages, index, prompts, urls } = buildLabShards(items);

  // Clear stale shards so hidden/deleted entries never linger (prompts/ and
  // browse/ are fully regenerated each run).
  for (const sub of ["lab/browse", "lab/prompts"]) {
    const dir = resolve(DATA_DIR, sub);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }

  writeJson(resolve(DATA_DIR, "lab-home.json"), home);
  pages.forEach((rows, n) => {
    writeJson(resolve(DATA_DIR, `lab/browse/page-${String(n).padStart(3, "0")}.json`), rows);
  });
  writeJson(resolve(DATA_DIR, "lab-index.json"), index);
  // SSG-side URL map (slug → thumb/detail/lightbox/og/orig). Imported ONLY by
  // data-lab-ssg (server build), never the client bundle.
  writeJson(resolve(DATA_DIR, "lab-urls.json"), urls);
  const promptSlugs = Object.keys(prompts);
  for (const slug of promptSlugs) {
    writeJson(resolve(DATA_DIR, `lab/prompts/${slug}.json`), prompts[slug]);
  }

  console.log(
    `lab: ${home.totalCount} 条可见 → home(48) + ${pages.length} 页 browse + ${promptSlugs.length} 条 prompt 分片 (revision ${home.revision})`,
  );
}

// Only run main when executed directly (not imported by tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
