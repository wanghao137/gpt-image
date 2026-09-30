/**
 * Purge NONCURRENT object versions from the store bucket using S3 version
 * semantics (IsLatest), freeing cap headroom. The 2026-09-29 native-API
 * attempt guessed "newest" from upload timestamps; ListObjectVersions'
 * IsLatest flag is authoritative. Keeps every current version untouched.
 *
 * Usage: node scripts/purge-noncurrent-versions.mjs [--dry-run]
 */
import { config as loadDotenv } from "dotenv";
import {
  S3Client,
  ListObjectVersionsCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

loadDotenv({ path: ".env.local" });

const DRY = process.argv.includes("--dry-run");
const client = new S3Client({
  region: "auto",
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  credentials: {
    accessKeyId: process.env.B2_STORE_KEY_ID,
    secretAccessKey: process.env.B2_STORE_APP_KEY,
  },
});
const BUCKET = process.env.B2_STORE_BUCKET || "taostudio-img";

let keyMarker;
let versionMarker;
let currentBytes = 0;
let currentCount = 0;
const noncurrent = [];
for (;;) {
  const r = await client.send(
    new ListObjectVersionsCommand({
      Bucket: BUCKET,
      MaxKeys: 1000,
      KeyMarker: keyMarker,
      VersionIdMarker: versionMarker,
    }),
  );
  for (const v of r.Versions || []) {
    if (v.IsLatest) {
      currentCount += 1;
      currentBytes += v.Size || 0;
    } else {
      noncurrent.push({ key: v.Key, versionId: v.VersionId, size: v.Size || 0 });
    }
  }
  if (!r.IsTruncated) break;
  keyMarker = r.NextKeyMarker;
  versionMarker = r.NextVersionIdMarker;
}
const noncurrentBytes = noncurrent.reduce((a, v) => a + v.size, 0);
console.log(
  `current: ${currentCount} objects, ${(currentBytes / 1073741824).toFixed(2)}GB | ` +
    `noncurrent: ${noncurrent.length} versions, ${(noncurrentBytes / 1073741824).toFixed(2)}GB`,
);
if (DRY || !noncurrent.length) {
  console.log(DRY ? "dry-run — nothing deleted" : "nothing to delete");
  process.exit(0);
}

let done = 0;
let freed = 0;
const workers = Array.from({ length: 8 }, async () => {
  for (;;) {
    const v = noncurrent.pop();
    if (!v) return;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: BUCKET, Key: v.key, VersionId: v.versionId }),
        );
        done += 1;
        freed += v.size;
        break;
      } catch (err) {
        if (attempt === 5) console.error(`delete failed ${v.key}: ${err.message}`);
        else await new Promise((res) => setTimeout(res, 400 * attempt));
      }
    }
    if (done % 2000 === 0 && done) console.log(`  progress ${done} deleted, ${(freed / 1073741824).toFixed(2)}GB freed`);
  }
});
await Promise.all(workers);
console.log(`DONE: ${done} noncurrent versions deleted, ${(freed / 1073741824).toFixed(2)}GB freed`);
