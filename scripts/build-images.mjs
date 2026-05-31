/**
 * Image pipeline.
 *
 * Downloads every image referenced from cases.json + templates.json (plus
 * /uploads/* originals) and emits a deterministic, deploy-friendly set of
 * variants under `public/images/`. For each source we produce:
 *
 *   case123.jpg          ← 1200 px JPEG (mozjpeg q=80, progressive). Kept
 *                          as the canonical fallback / OG card / link
 *                          target. cases.json's imageUrl still points here.
 *   case123-320.webp     ← responsive WebP variants (4:80 → 5:80 q vs
 *   case123-480.webp        the JPEG, ~30-40% smaller at the same fidelity).
 *   case123-640.webp        Generated for above-the-fold thumbnails so
 *   case123-960.webp        mobile cards never download a 1200 px file.
 *
 * Why multiple variants:
 *   The previous pipeline emitted ONE 1200 px JPEG per source. SmartImg
 *   couldn't generate a real srcset because there were no real width
 *   variants on disk — every <img> downloaded the full 1200 px file even
 *   for a 56 px thumbnail. On Chinese mobile this dominated first-paint
 *   time. WebP at q=78 routinely lands the same image at 30-50% of the
 *   JPEG bytes; multi-width srcset lets the browser pick the right one.
 *
 * Why NOT multiple JPEG widths:
 *   By 2026, WebP support is ≥96% across iOS Safari, Android Chrome, and
 *   the WeChat / Xiaohongshu / Douyin in-app browsers. The remaining
 *   long-tail downloads the canonical 1200 JPEG via <img>'s plain `src`
 *   attribute — not great but not catastrophic, and saves us ~170 MB of
 *   build artefacts that almost no one would ever consume.
 *
 * Why NOT AVIF:
 *   sharp's AVIF encode is 4-6× slower than WebP and the savings (~10%
 *   over WebP) don't justify lengthening the prebuild on every Vercel
 *   redeploy. Easy to add later if it becomes worth it.
 *
 * After this script runs, cases.json + templates.json are rewritten so
 * `imageUrl` / `cover` point at the canonical local `/images/<id>.jpg`
 * — same as before, so admin tooling and external links keep working.
 *
 * Usage:
 *   node scripts/build-images.mjs                     - normal run
 *   node scripts/build-images.mjs --force             - re-encode everything
 *   node scripts/build-images.mjs --concurrency 16    - more parallel downloads
 *   node scripts/build-images.mjs --strict            - fail if any source fails
 *
 * Env knobs:
 *   IMAGE_MAX_WIDTH   default 1200       (canonical JPEG width)
 *   IMAGE_QUALITY     default 80         (canonical JPEG quality)
 *   IMAGE_WEBP_Q      default 78         (WebP quality across all widths)
 *   IMAGE_VARIANTS    default "320,480,640,960"  (comma-separated WebP widths)
 *   IMAGE_SKIP_NET    "1" → don't fetch from the network, only re-process
 *                     local cache (useful when offline mid-build).
 *   IMAGE_STRICT      "1" → exit non-zero if a source cannot be localised.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  applyImageRewrites,
  isRetriableImageFetchFailure,
  shouldProcessExistingVariants,
} from "./build-images-core.mjs";

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
const STRICT = args.has("--strict") || process.env.IMAGE_STRICT === "1";
const CONCURRENCY_ARG = process.argv.indexOf("--concurrency");
const CONCURRENCY_RAW = CONCURRENCY_ARG > -1 ? Number(process.argv[CONCURRENCY_ARG + 1]) : 8;
// Guard against a non-numeric / non-positive --concurrency value. Without this,
// `Number("abc")` → NaN → `Math.min(NaN, len)` → NaN workers → the whole
// pipeline silently processes nothing while reporting success.
const CONCURRENCY =
  Number.isFinite(CONCURRENCY_RAW) && CONCURRENCY_RAW >= 1
    ? Math.floor(CONCURRENCY_RAW)
    : 8;
const MAX_WIDTH = Number(process.env.IMAGE_MAX_WIDTH || 1200);
const QUALITY = Number(process.env.IMAGE_QUALITY || 80);
const WEBP_Q = Number(process.env.IMAGE_WEBP_Q || 78);
const VARIANTS = (process.env.IMAGE_VARIANTS || "320,480,640,960")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0)
  .sort((a, b) => a - b);
const SKIP_NET = process.env.IMAGE_SKIP_NET === "1";
const FETCH_RETRIES = Number(process.env.IMAGE_FETCH_RETRIES || 3);

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(CACHE_DIR, { recursive: true });

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileWithRetry(path, JSON.stringify(data), "utf8");
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeFileWithRetry(path, data, encoding = "utf8") {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      writeFileSync(path, data, encoding);
      return;
    } catch (error) {
      const code = error?.code;
      if (!["UNKNOWN", "EBUSY", "EPERM", "EACCES"].includes(code) || attempt === 7) {
        throw error;
      }
      sleepSync(75 * (attempt + 1));
    }
  }
}

function sha1(s) {
  return createHash("sha1").update(s).digest("hex");
}

/**
 * Local file path inside our raw-bytes cache. We key by the *content* hash
 * of the URL itself so URL changes invalidate naturally. A URL with the
 * same content as another URL (e.g. case dataset + admin upload pointing
 * at the same image) still gets one local copy. The raw cache is shared
 * across all variants — we fetch once and re-encode N times locally.
 */
function cachePath(url) {
  const h = sha1(url);
  return resolve(CACHE_DIR, `${h}${extname(new URL(url).pathname) || ".bin"}`);
}

/**
 * Canonical base name (without extension) for a record. The base name is
 * what cases.json points at via `<base>.jpg`; responsive variants are
 * `<base>-<width>.webp`.
 */
function outputBaseName(kind, id, originalUrl) {
  if (kind === "case") return `case${id}`;
  if (kind === "template") return `template${id}`;
  if (kind === "upload") {
    // Admin uploads use the date+id naming convention from the uploader.
    // Strip extension; we always emit .jpg / .webp.
    return originalUrl.split("/").pop().replace(/\.[^.]+$/, "");
  }
  return sha1(originalUrl).slice(0, 16);
}

async function fetchToBuffer(url) {
  if (SKIP_NET) throw new Error("skipped: IMAGE_SKIP_NET=1");
  let lastError;
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    // Per-attempt timeout so a stalled (non-erroring) connection trips the
    // retry path instead of hanging a worker forever.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const r = await fetch(url, {
        headers: {
          "user-agent":
            "gpt-image-image-pipeline/1.0 (+https://taostudioai.com)",
          accept: "image/*",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (err) {
      lastError = err;
      if (attempt >= FETCH_RETRIES || !isRetriableImageFetchFailure(err)) break;
      await sleep(350 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/**
 * Get raw bytes for a remote URL, caching to disk on first fetch. Returns
 * a Buffer. Cached under node_modules/.image-cache (auto-cleaned by
 * `npm ci` in CI, persistent locally) so cold builds don't re-pay the
 * network cost across PRs but local dev iteration is instant.
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
 * Encode a sharp pipeline at `width` into the requested format. Width is
 * a hard cap — sources smaller than `width` stay at their native size,
 * sources larger get downscaled. Always preserves EXIF orientation.
 */
async function encodeVariant(buf, width, format) {
  const pipeline = sharp(buf, { failOn: "none" })
    .resize({ width, withoutEnlargement: true })
    .rotate();

  if (format === "webp") {
    return pipeline
      .webp({
        quality: WEBP_Q,
        // 'effort: 4' is the default and a good speed/compression trade —
        // pushing to 6 saves ~3% bytes for ~3× encode time, not worth it
        // when the pipeline runs on every Vercel deploy.
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer();
  }

  // jpg fallback path — same params as the canonical image so the 1200 px
  // file we keep matches the historical output byte-for-byte.
  return pipeline
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

/**
 * Process a single record (case / template / upload). Emits one canonical
 * 1200 px JPEG plus N responsive WebP variants. Each variant is skipped
 * independently if its file already exists on disk — so adding a new
 * variant width to VARIANTS only re-encodes the missing widths.
 */
async function processOne(rec) {
  const baseName = outputBaseName(rec.kind, rec.id, rec.url);
  const canonicalPath = `/images/${baseName}.jpg`;
  const canonicalFile = resolve(OUT_DIR, `${baseName}.jpg`);

  // Define the full variant set: 1 JPEG (canonical, 1200) + N WebPs.
  const variants = [
    { file: `${baseName}.jpg`, width: MAX_WIDTH, format: "jpg" },
    ...VARIANTS.map((w) => ({
      file: `${baseName}-${w}.webp`,
      width: w,
      format: "webp",
    })),
  ];

  // Fast path: every variant already exists and we're not forcing.
  const allVariantsExist = variants.every((v) => existsSync(resolve(OUT_DIR, v.file)));
  if (!shouldProcessExistingVariants({ force: FORCE, allVariantsExist, rec })) {
    return { ok: true, rec, canonicalPath, skipped: true };
  }

  // Fetch raw bytes once for all variants of this source.
  let raw;
  let reusedExistingFallback = false;
  let fallbackReason;
  if (rec.kind === "upload" || rec.localFile) {
    // Either an admin upload or a previously-baked canonical JPEG that
    // we're re-encoding into WebP variants. Either way the source is on
    // disk — no network hop needed.
    try {
      raw = readLocal(rec.localFile);
    } catch (err) {
      return {
        ok: false,
        rec,
        err,
        fallbackPath: allVariantsExist ? canonicalPath : undefined,
      };
    }
  } else {
    try {
      raw = await fetchCached(rec.url);
    } catch (err) {
      if (allVariantsExist) {
        return {
          ok: true,
          rec,
          canonicalPath,
          skipped: true,
          reusedExistingFallback: true,
          fallbackReason: err,
        };
      }
      if (existsSync(canonicalFile)) {
        try {
          raw = readLocal(canonicalFile);
          reusedExistingFallback = true;
          fallbackReason = err;
        } catch (fallbackErr) {
          return { ok: false, rec, err, fallbackErr };
        }
      } else {
        return {
          ok: false,
          rec,
          err,
          fallbackPath: allVariantsExist ? canonicalPath : undefined,
        };
      }
    }
  }

  // Encode each missing variant. Per-variant skip means re-runs after a
  // partial failure (e.g. one width OOMed) only redo what's missing.
  let bytesIn = 0;
  let bytesOut = 0;
  let processed = 0;
  let skippedVariants = 0;
  for (const v of variants) {
    const out = resolve(OUT_DIR, v.file);
    if (existsSync(out) && !FORCE) {
      skippedVariants += 1;
      continue;
    }
    try {
      const encoded = await encodeVariant(raw, v.width, v.format);
      writeFileSync(out, encoded);
      processed += 1;
      bytesIn += raw.length;
      bytesOut += encoded.length;
    } catch (err) {
      // Encoding failed for one variant — bail on this record so we can
      // surface the error and avoid leaving cases.json half-rewritten.
      return {
        ok: false,
        rec,
        err,
        fallbackPath: allVariantsExist ? canonicalPath : undefined,
      };
    }
  }

  return {
    ok: true,
    rec,
    canonicalPath,
    skipped: false,
    processed,
    skippedVariants,
    bytesIn,
    bytesOut,
    reusedExistingFallback,
    fallbackReason,
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
        // Remote upstream URL (first build, or new case from sync).
        tasks.push({ kind: "case", targetKind: "case", id: c.id, url: c.imageUrl });
      } else if (c.imageUrl?.startsWith("/uploads/")) {
        // Admin-uploaded original — read from disk.
        const localFile = resolve(PUBLIC_DIR, c.imageUrl.replace(/^\/+/, ""));
        if (existsSync(localFile)) {
          tasks.push({
            kind: "upload",
            targetKind: "case",
            id: c.id,
            url: c.imageUrl,
            localFile,
          });
        }
      } else if (c.imageUrl?.startsWith("/images/")) {
        // Already-baked canonical JPEG from a previous build. We still
        // want to (re)generate its responsive WebP variants — the JPEG
        // we baked earlier is the source we re-encode from.
        const localFile = resolve(PUBLIC_DIR, c.imageUrl.replace(/^\/+/, ""));
        if (existsSync(localFile)) {
          tasks.push({
            kind: "case",
            targetKind: "case",
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
        tasks.push({ kind: "template", targetKind: "template", id: t.id, url: t.cover });
      } else if (t.cover?.startsWith("/images/")) {
        const localFile = resolve(PUBLIC_DIR, t.cover.replace(/^\/+/, ""));
        if (existsSync(localFile)) {
          tasks.push({
            kind: "template",
            targetKind: "template",
            id: t.id,
            url: t.cover,
            localFile,
          });
        }
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
        targetKind: "upload",
        id: f.replace(/\.[^.]+$/, ""),
        url,
        localFile,
      });
    }
  }

  console.log(
    `image pipeline: ${tasks.length} sources × ${1 + VARIANTS.length} variants -> ${OUT_DIR}\n` +
      `  jpg: ${MAX_WIDTH}w q=${QUALITY}\n` +
      `  webp: [${VARIANTS.join(", ")}] q=${WEBP_Q}`,
  );

  // Step 2: process them with bounded concurrency.
  const results = await pmap(tasks, processOne, CONCURRENCY);

  // Step 3: rewrite cases.json + templates.json `imageUrl` / `cover`.
  // Successful sources point at their canonical baked JPEG. If a remote
  // source fails but a previous local build exists, keep that local image.
  // Unrecoverable failures are left unchanged so a transient network issue
  // cannot publish the permanent image-unavailable placeholder.
  let recordsProcessed = 0;
  let recordsSkipped = 0;
  let recordsRecovered = 0;
  let variantsWritten = 0;
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
    if (r.reusedExistingFallback) {
      recordsRecovered += 1;
      const e =
        r.fallbackReason instanceof Error
          ? r.fallbackReason.message
          : String(r.fallbackReason ?? "source failed");
      console.warn(
        `  REUSED existing ${r.rec.kind}#${r.rec.id} -> ${r.canonicalPath}: ${e}`,
      );
    }
    if (r.skipped) recordsSkipped += 1;
    else recordsProcessed += 1;
    if (r.processed) variantsWritten += r.processed;
    if (r.bytesIn) bytesIn += r.bytesIn;
    if (r.bytesOut) bytesOut += r.bytesOut;
  }

  // Apply rewrites.
  const { casesRewrites, templatesRewrites } = applyImageRewrites({
    cases,
    templates,
    results,
  });

  if (casesRewrites > 0) {
    writeJson(CASES_PATH, cases);
    console.log(`  rewrote imageUrl on ${casesRewrites} cases -> ${CASES_PATH}`);
  }
  if (templatesRewrites > 0) {
    writeJson(TEMPLATES_PATH, templates);
    console.log(`  rewrote cover on ${templatesRewrites} templates -> ${TEMPLATES_PATH}`);
  }

  const ratio =
    bytesIn > 0
      ? `${((1 - bytesOut / bytesIn) * 100).toFixed(0)}% saved on encoded variants`
      : "n/a";
  console.log(
    `done. records: processed=${recordsProcessed} skipped=${recordsSkipped} recovered=${recordsRecovered} failed=${failed}\n` +
      `      variants written=${variantsWritten} (${ratio})`,
  );
  if (failed > 0) {
    const msg =
      "some sources failed without an existing local fallback; records were " +
      "left unchanged instead of being rewritten to a placeholder.";
    if (STRICT) {
      console.error(`${msg} strict mode is enabled.`);
      process.exit(2);
    }
    console.warn(msg);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
