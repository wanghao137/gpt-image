/**
 * Trim byte-identical 1280 WebP variants from the store.
 *
 * encodeVariant uses withoutEnlargement, so for every source whose width is
 * ≤960 the encoded 1280 rung is a byte-identical duplicate of the 960 rung.
 * Those duplicates are pure storage waste (~0.42GiB across 3.7K cases,
 * 2026-09-30) and pushed the bucket against B2's free-tier cap. This script
 * deletes them from the bucket and drops the width from the manifest —
 * cases.json URLs stay untouched, and api/img-case.js serves -960.webp bytes
 * for -1280.webp requests (identical by construction), so the visible ladder
 * never changes.
 *
 * Only exact byte-equality (via manifest sizes) qualifies. Real 1280s
 * (sources >960 wide) are never touched.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

const client = new S3Client({
  region: "auto",
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  credentials: {
    accessKeyId: process.env.B2_STORE_KEY_ID,
    secretAccessKey: process.env.B2_STORE_APP_KEY,
  },
});
const BUCKET = process.env.B2_STORE_BUCKET || "taostudio-img";

const manifest = JSON.parse(readFileSync("data/image-store.json", "utf8"));
const entries = manifest.entries || {};

const doomed = [];
for (const [base, e] of Object.entries(entries)) {
  const w960 = e?.webpBytes?.[960] || 0;
  const w1280 = e?.webpBytes?.[1280] || 0;
  if (w1280 > 0 && w1280 === w960) doomed.push({ base, bytes: w1280 });
}
const freedBytes = doomed.reduce((a, d) => a + d.bytes, 0);
console.log(
  `${doomed.length} byte-identical 1280 rungs, ${(freedBytes / 1073741824).toFixed(2)}GiB to free`,
);
if (!doomed.length) process.exit(0);

let done = 0;
const workers = Array.from({ length: 8 }, async () => {
  for (;;) {
    const d = doomed.pop();
    if (!d) return;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: BUCKET, Key: `cases/${d.base}-1280.webp` }),
        );
        done += 1;
        // Drop the width from the manifest entry.
        const e = entries[d.base];
        e.widths = e.widths.filter((w) => w !== 1280);
        delete e.webpBytes[1280];
        break;
      } catch (err) {
        if (attempt === 5) console.error(`delete failed ${d.base}: ${err.message}`);
        else await new Promise((res) => setTimeout(res, 400 * attempt));
      }
    }
  }
});
await Promise.all(workers);
writeFileSync("data/image-store.json", JSON.stringify(manifest));
console.log(`trimmed ${done}/${doomed.length + 0}; manifest updated — commit data/image-store.json`);
