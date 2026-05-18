/**
 * Image pipeline.
 *
 * Downloads every image referenced from cases.json + templates.json (plus
 * /uploads/* originals) and emits a deterministic, deploy-friendly copy
 * under `public/images/`. Each image is:
 *
 *   - resized to a max width of 1200 px (preserving aspect ratio)
 *   - re-encoded as JPEG quality 80, mozjpeg, progressive
 *   - cached locally by source-URL hash so repeat runs are instant
 *
 * After this script runs, the case dataset's `imageUrl` is *also* rewritten
 * in-place to point at the local `/images/<id>.jpg` path. The site never
 * makes an outbound image request again — every image lives on the same
 * Cloudflare Pages edge as the HTML.
 *
 * Why this exists:
 *   wsrv.nl is North-America-hosted and hits ~1.7s TTFB from mainland China.
 *   Tencent COS HK is closer (~700ms) but adds a transform hop and only
 *   covers admin uploads. The competitor reference site
 *   (https://gpt-image2.canghe.ai) gets <300ms by simply baking JPEGs into
 *   their Vercel deploy. This script ports that strategy to Cloudflare Pages.
 *
 * Usage:
 *   node scripts/images.mjs                           - normal run
 *   node scripts/images.mjs --force                   - re-encode everything
 *   node scripts/images.mjs --concurrency 16          - more parallel downloads
 *
 * Env knobs:
 *   IMAGE_MAX_WIDTH   default 1200
 *   IMAGE_QUALITY     default 80
 *   IMAGE_SKIP_NET    "1" → don't fetch from the network, only re-process
 *                     local cache (useful when offline mid-build).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = resolve(ROOT, "public");
const OUT_DIR = resolve(PUBLIC_DIR, "images");
const CACHE_DIR = resolve(ROOT, "node_modules/.image-cache");
const UPLOADS_DIR = resolve(PUBLIC_DIR, "uploads");
const CASES_PATH = resolve(PUBLIC_DIR, "data/cases.json");
const TEMPLATES_PATH = resolve(PUBLIC_DIR, "data/templates.json");

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const CONCURRENCY_ARG = process.argv.indexOf("--concurrency");
const CONCURRENCY = CONCURRENCY_ARG > -1 ? Number(process.argv[CONCURRENCY_ARG + 1]) : 8;
const MAX_WIDTH = Number(process.env.IMAGE_MAX_WIDTH || 1200);
const QUALITY = Number(process.env.IMAGE_QUALITY || 80);
const SKIP_NET = process.env.IMAGE_SKIP_NET === "1";

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(CACHE_DIR, { recursive: true });

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data), "utf8");
}

function sha1(s) {
  return createHash("sha1").update(s).digest("hex");
}

/**
 * Local file path inside our raw-bytes cache. We key by the *content* hash
 * of the URL itself so URL changes invalidate naturally. A URL with the
 * same content as another URL (e.g. case dataset + admin upload pointing
 * at the same image) still gets one local copy.
 */
function cachePath(url) {
  const h = sha1(url);
  return resolve(CACHE_DIR, `${h}${extname(new URL(url).pathname) || ".bin"}`);
}

/**
 * Final filename inside `public/images/`. Stable + recognisable so cases
 * directly reference `/images/case<id>.jpg` (matching the dataset's natural
 * naming), with admin uploads getting an `admin-<file>.jpg` prefix to avoid
 * any chance of collision.
 */
function outputNameFor(kind, id, originalUrl) {
  if (kind === "case") return `case${id}.jpg`;
  if (kind === "template") return `template${id}.jpg`;
  if (kind === "upload") {
    // Admin uploads use the date+id naming convention from the uploader.
    // Strip extension; we always emit .jpg.
    const base = originalUrl.split("/").pop().replace(/\.[^.]+$/, "");
    return `${base}.jpg`;
  }
  // Last-resort: hash of the URL, .jpg.
  return `${sha1(originalUrl).slice(0, 16)}.jpg`;
}

async function fetchToBuffer(url) {
  if (SKIP_NET) throw new Error("skipped: IMAGE_SKIP_NET=1");
  const r = await fetch(url, {
    headers: {
      "user-agent":
        "gpt-image-image-pipeline/1.0 (+https://gpt-image-6hu.pages.dev)",
      accept: "image/*",
    },
    redirect: "follow",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return Buffer.from(await r.arrayBuffer());
}

/**
 * Get raw bytes for a remote URL, caching to disk on first fetch. Returns
 * a Buffer.
 *
 * The cache is kept under node_modules/.image-cache (auto-cleaned by
 * `npm ci` in CI, persistent locally) so cold builds in CF Pages CI don't
 * re-pay the cost across PRs but local dev iteration is instant.
 */
async function fetchCached(url) {
  const p = cachePath(url);
  if (existsSync(p) && !FORCE) {
    return readFileSync(p);
  }
  const buf = await fetchToBuffer(url);
  writeFileSync(p, buf);
  return buf;
}

/** Read raw bytes from a local file path (used for /uploads/*). */
function readLocal(localPath) {
  return readFileSync(localPath);
}

/**
 * Encode bytes → web-friendly JPEG. Uses sharp's mozjpeg pipeline which
 * produces ~15% smaller files than standard libjpeg at equivalent quality
 * scores. PNG inputs lose transparency on the JPEG → that's fine for our
 * dataset (every case image is a flat photo / poster).
 */
async function encode(buf) {
  return sharp(buf, { failOn: "none" })
    .resize({
      width: MAX_WIDTH,
      withoutEnlargement: true, // never upscale; tiny originals stay tiny
    })
    .rotate() // honour EXIF orientation
    .jpeg({
      quality: QUALITY,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: "4:2:0",
    })
    .toBuffer();
}

/** Run an async fn over an array with bounded concurrency. */
async function pmap(items, fn, n) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i], i);
      } catch (err) {
        out[i] = { ok: false, err };
      }
    }
  });
  await Promise.all(workers);
  return out;
}

/** Process a single record (case / template / upload). */
async function processOne(rec) {
  const outName = outputNameFor(rec.kind, rec.id, rec.url);
  const outPath = resolve(OUT_DIR, outName);
  const localPath = `/images/${outName}`;

  // Fast path: already encoded and not forcing.
  if (existsSync(outPath) && !FORCE) {
    return { ok: true, rec, localPath, skipped: true };
  }

  let raw;
  if (rec.kind === "upload") {
    raw = readLocal(rec.localFile);
  } else {
    try {
      raw = await fetchCached(rec.url);
    } catch (err) {
      return { ok: false, rec, err };
    }
  }

  let encoded;
  try {
    encoded = await encode(raw);
  } catch (err) {
    return { ok: false, rec, err };
  }

  writeFileSync(outPath, encoded);
  return {
    ok: true,
    rec,
    localPath,
    skipped: false,
    inSize: raw.length,
    outSize: encoded.length,
  };
}

async function main() {
  // Step 1: collect every image we need to localise.
  /** @type {Array<{kind: 'case'|'template'|'upload', id: string, url: string, localFile?: string}>} */
  const tasks = [];

  let cases = [];
  if (existsSync(CASES_PATH)) {
    cases = readJson(CASES_PATH);
    for (const c of cases) {
      if (c.imageUrl && /^https?:\/\//i.test(c.imageUrl)) {
        tasks.push({ kind: "case", id: c.id, url: c.imageUrl });
      } else if (c.imageUrl?.startsWith("/uploads/")) {
        const localFile = resolve(PUBLIC_DIR, c.imageUrl.replace(/^\/+/, ""));
        if (existsSync(localFile)) {
          tasks.push({
            kind: "upload",
            id: c.id,
            url: c.imageUrl,
            localFile,
          });
        }
      }
    }
  }

  let templates = [];
  if (existsSync(TEMPLATES_PATH)) {
    templates = readJson(TEMPLATES_PATH);
    for (const t of templates) {
      if (t.cover && /^https?:\/\//i.test(t.cover)) {
        tasks.push({ kind: "template", id: t.id, url: t.cover });
      }
    }
  }

  // Also process any /uploads/* not already referenced from cases.json
  // (defensive — keeps orphan uploads available locally).
  if (existsSync(UPLOADS_DIR)) {
    for (const f of readdirSync(UPLOADS_DIR)) {
      if (f.startsWith(".")) continue;
      const localFile = resolve(UPLOADS_DIR, f);
      if (!statSync(localFile).isFile()) continue;
      const url = `/uploads/${f}`;
      if (tasks.some((t) => t.url === url)) continue;
      tasks.push({
        kind: "upload",
        id: f.replace(/\.[^.]+$/, ""),
        url,
        localFile,
      });
    }
  }

  console.log(
    `image pipeline: ${tasks.length} sources -> ${OUT_DIR} (max width ${MAX_WIDTH}, q=${QUALITY})`,
  );

  // Step 2: process them with bounded concurrency.
  const results = await pmap(tasks, processOne, CONCURRENCY);

  // Step 3: rewrite cases.json + templates.json `imageUrl` / `cover` to the
  // new local paths. We do this AFTER all encoding succeeds so partial
  // builds don't leave cases pointing at non-existent local files.
  const localByOriginal = new Map();
  let processed = 0;
  let skipped = 0;
  let bytesIn = 0;
  let bytesOut = 0;
  let failed = 0;

  for (const r of results) {
    if (!r) continue;
    if (!r.ok) {
      failed += 1;
      const e = r.err instanceof Error ? r.err.message : String(r.err);
      console.warn(`  FAILED ${r.rec.kind}#${r.rec.id} <- ${r.rec.url}: ${e}`);
      continue;
    }
    if (r.skipped) skipped += 1;
    else processed += 1;
    if (r.inSize) bytesIn += r.inSize;
    if (r.outSize) bytesOut += r.outSize;
    localByOriginal.set(r.rec.url, r.localPath);
  }

  // Apply rewrites.
  let casesRewrites = 0;
  for (const c of cases) {
    const local = localByOriginal.get(c.imageUrl);
    if (local && c.imageUrl !== local) {
      c.imageUrl = local;
      casesRewrites += 1;
    }
  }
  let templatesRewrites = 0;
  for (const t of templates) {
    const local = localByOriginal.get(t.cover);
    if (local && t.cover !== local) {
      t.cover = local;
      templatesRewrites += 1;
    }
  }

  if (casesRewrites > 0) {
    writeJson(CASES_PATH, cases);
    console.log(`  rewrote imageUrl on ${casesRewrites} cases -> ${CASES_PATH}`);
  }
  if (templatesRewrites > 0) {
    writeJson(TEMPLATES_PATH, templates);
    console.log(`  rewrote cover on ${templatesRewrites} templates -> ${TEMPLATES_PATH}`);
  }

  const ratio =
    bytesIn > 0 ? `${((1 - bytesOut / bytesIn) * 100).toFixed(0)}%` : "n/a";
  console.log(
    `done. processed=${processed} skipped=${skipped} failed=${failed} (saved ${ratio})`,
  );
  if (failed > 0) {
    console.error("some sources failed; site will fall back to original URLs for those.");
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
