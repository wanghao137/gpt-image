/**
 * Upload `public/uploads/*` to Tencent Cloud COS (Hong Kong region).
 *
 * Why this exists:
 *   The site deploys static files via Cloudflare Pages. CF Pages' edge POPs
 *   are routed to non-mainland regions for free-tier traffic, which means
 *   mainland-China users hit US/JP nodes for /uploads/<file>.png and pay a
 *   ~700ms RTT on top of the bytes. Tencent Cloud COS HK is consistently
 *   <100ms RTT from CN telecom/unicom/mobile and supports on-the-fly WebP
 *   resize via URL params (`?imageMogr2/format/webp/thumbnail/720x`), so we
 *   move the heavy uploaded originals there and leave only HTML/JS/CSS on
 *   CF Pages.
 *
 * What it does:
 *   1. Reads every file under `public/uploads/` (recursively).
 *   2. Hashes each local file (sha1 of contents).
 *   3. Lists existing keys in COS under `uploads/`.
 *   4. For each local file:
 *        - upload if missing remotely
 *        - upload if remote ETag (= md5 for un-multipart uploads) differs
 *        - skip otherwise
 *   5. Reports counts.
 *
 * Idempotent: safe to re-run any time. Use it after admin uploads a new
 * image, or wire it into a `postupload` hook.
 *
 * Usage:
 *   1. Copy `.env.example` to `.env.local` and fill COS_SECRET_ID +
 *      COS_SECRET_KEY (sub-account key with QcloudCOSDataFullControl).
 *   2. `node scripts/upload-cos.mjs`
 *
 * Required env (read from process.env or `.env.local`):
 *   COS_BUCKET    — the bucket name with appid suffix, e.g.
 *                   "gpt-image-2-1259488227"
 *   COS_REGION    — bucket region, e.g. "ap-hongkong"
 *   COS_SECRET_ID
 *   COS_SECRET_KEY
 *
 * NEVER commit the secret pair. .env.local is gitignored.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import COS from "cos-nodejs-sdk-v5";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Load `.env.local` if present. We don't fail on missing — env vars set
// directly (e.g. in CI) are also a valid configuration.
loadDotenv({ path: resolve(ROOT, ".env.local") });

const BUCKET = process.env.COS_BUCKET;
const REGION = process.env.COS_REGION;
const SECRET_ID = process.env.COS_SECRET_ID;
const SECRET_KEY = process.env.COS_SECRET_KEY;

if (!BUCKET || !REGION || !SECRET_ID || !SECRET_KEY) {
  console.error(
    "missing COS env vars. Set COS_BUCKET, COS_REGION, COS_SECRET_ID, COS_SECRET_KEY in .env.local",
  );
  process.exit(1);
}

const UPLOADS_DIR = resolve(ROOT, "public/uploads");
// Files we never need on the CDN. .gitkeep is a marker, system files are noise.
const SKIP = new Set([".gitkeep", ".DS_Store", "Thumbs.db"]);

const cos = new COS({
  SecretId: SECRET_ID,
  SecretKey: SECRET_KEY,
});

/** Recursively walk a directory, returning absolute file paths. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile() && !SKIP.has(entry.name)) out.push(p);
  }
  return out;
}

/** sha1 hex of file contents — used as a deterministic id for logs. */
function sha1(buf) {
  return createHash("sha1").update(buf).digest("hex");
}

/** md5 hex (matches the COS ETag for non-multipart uploads). */
function md5(buf) {
  return createHash("md5").update(buf).digest("hex");
}

/**
 * Map filename extension to a Content-Type. COS will infer a default but
 * being explicit avoids the "application/octet-stream" trap on CDN hits.
 */
function contentTypeFor(filename) {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    case "avif": return "image/avif";
    case "gif": return "image/gif";
    case "svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}

/** Promisified COS calls — the SDK is callback-based by default. */
function call(fn, params) {
  return new Promise((res, rej) => {
    fn.call(cos, params, (err, data) => (err ? rej(err) : res(data)));
  });
}

/** List all object keys under a prefix, paging until done. */
async function listAllKeys(prefix) {
  /** @type {Map<string, string>} key -> ETag (without quotes) */
  const out = new Map();
  let marker = "";
  // Cap at ~10k items — well above what we'll ever hit, and a defensive
  // bound against an infinite paging loop.
  for (let i = 0; i < 100; i += 1) {
    const data = await call(cos.getBucket, {
      Bucket: BUCKET,
      Region: REGION,
      Prefix: prefix,
      Marker: marker,
      MaxKeys: 1000,
    });
    for (const o of data.Contents || []) {
      // ETag comes wrapped in quotes; strip them so we can compare to md5.
      out.set(o.Key, (o.ETag || "").replaceAll('"', "").toLowerCase());
    }
    if (data.IsTruncated === "true" && data.NextMarker) {
      marker = data.NextMarker;
    } else {
      break;
    }
  }
  return out;
}

async function main() {
  if (!statSync(UPLOADS_DIR, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`uploads dir not found: ${UPLOADS_DIR}`);
    process.exit(1);
  }

  console.log(`> scanning ${UPLOADS_DIR}`);
  const localFiles = walk(UPLOADS_DIR);
  console.log(`> found ${localFiles.length} local files`);

  console.log(`> listing remote keys under uploads/ in ${BUCKET} (${REGION})`);
  const remote = await listAllKeys("uploads/");
  console.log(`> found ${remote.size} remote keys`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of localFiles) {
    // Build the COS key as the path relative to public/, using forward slashes
    // (COS keys are POSIX-style regardless of host OS).
    const rel = relative(resolve(ROOT, "public"), file).split(/[\\/]/).join("/");
    const Key = posix.normalize(rel);
    const buf = readFileSync(file);
    const localMd5 = md5(buf);
    const remoteEtag = remote.get(Key);

    if (remoteEtag === localMd5) {
      skipped += 1;
      continue;
    }

    try {
      await call(cos.putObject, {
        Bucket: BUCKET,
        Region: REGION,
        Key,
        Body: buf,
        ContentType: contentTypeFor(file),
        // Long cache, content-addressed via filename (uploads use date+id).
        CacheControl: "public, max-age=31536000, immutable",
      });
      uploaded += 1;
      console.log(
        `  uploaded  ${Key}  ${(buf.length / 1024).toFixed(0)}KB  sha1=${sha1(buf).slice(0, 8)}`,
      );
    } catch (err) {
      failed += 1;
      console.error(`  FAILED    ${Key}: ${err.message || err}`);
    }
  }

  console.log("");
  console.log(`done. uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
