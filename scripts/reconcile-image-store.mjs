/**
 * Reconcile data/image-store.json against what is ACTUALLY in the B2 bucket.
 *
 * When chunks upload successfully but their manifest commit is lost (push
 * races, cap errors — both happened 2026-09-29/30), the manifest understates
 * the bucket. This tool lists every current object under cases/ and:
 *   - default: rebuilds full-ladder manifest entries (pure bookkeeping, no
 *     uploads) and reports how many cases.json externals are already covered;
 *   - --rewrite: additionally points covered cases at /images/cases/*.
 *
 * Run locally with B2_STORE_* in .env.local. The bucket is source of truth.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { config as loadDotenv } from "dotenv";
import { storeEnvReady, storeClient, B2_STORE_BUCKET } from "./image-store-client.mjs";

loadDotenv({ path: ".env.local" });

const WIDTHS = [320, 480, 640, 960, 1280];
const REWRITE = process.argv.includes("--rewrite");

if (!storeEnvReady()) {
  console.error("缺少 B2_STORE_* 环境变量（写入 .env.local）");
  process.exit(1);
}
const client = storeClient();

const byBase = new Map();
let token;
let objects = 0;
for (;;) {
  const r = await client.send(
    new ListObjectsV2Command({
      Bucket: B2_STORE_BUCKET,
      Prefix: "cases/",
      MaxKeys: 1000,
      ContinuationToken: token,
    }),
  );
  for (const o of r.Contents || []) {
    objects += 1;
    let m = String(o.Key).match(/^cases\/(case\d+)\.jpg$/i);
    if (m) {
      const e = byBase.get(m[1]) || { jpg: 0, webp: {} };
      e.jpg = o.Size || 0;
      byBase.set(m[1], e);
      continue;
    }
    m = String(o.Key).match(/^cases\/(case\d+)-(\d+)\.webp$/i);
    if (m) {
      const e = byBase.get(m[1]) || { jpg: 0, webp: {} };
      e.webp[Number(m[2])] = o.Size || 0;
      byBase.set(m[1], e);
    }
  }
  if (!r.IsTruncated) break;
  token = r.NextContinuationToken;
}
console.log(`listed ${objects} objects, ${byBase.size} bases with a canonical jpg`);

const manifest = JSON.parse(readFileSync("data/image-store.json", "utf8"));
const entries = { ...(manifest.entries || {}) };
let full = 0;
for (const [base, e] of byBase) {
  const widths = WIDTHS.filter((w) => (e.webp[w] || 0) > 0);
  if (e.jpg > 0 && widths.length === WIDTHS.length) {
    entries[base] = {
      widths: WIDTHS,
      jpgBytes: e.jpg,
      webpBytes: Object.fromEntries(widths.map((w) => [w, e.webp[w]])),
      // Preserve provenance; a bucket-observed ladder is real even when the
      // lost commit knew which source it came from.
      source: entries[base]?.source || "origin",
      bakedAt: entries[base]?.bakedAt || new Date().toISOString(),
    };
    full += 1;
  }
}
writeFileSync("data/image-store.json", JSON.stringify({ ...manifest, entries }));
console.log(`manifest: ${Object.keys(entries).length} entries (full-ladder ${full})`);

const cases = JSON.parse(readFileSync("public/data/cases.json", "utf8"));
const covered = (c) =>
  /^https?:\/\//.test(String(c.imageUrl || "")) &&
  (() => {
    const e = entries[`case${c.id}`];
    return e && e.source !== "failed" && e.jpgBytes > 0 && WIDTHS.every((w) => (e.webpBytes?.[w] || 0) > 0);
  })();

if (REWRITE) {
  let n = 0;
  for (const c of cases) {
    if (covered(c)) {
      c.imageUrl = `/images/cases/case${c.id}.jpg`;
      n += 1;
    }
  }
  writeFileSync("public/data/cases.json", JSON.stringify(cases));
  console.log(`rewrote ${n} cases to /images/cases/*`);
  console.log("next: node scripts/split-data.mjs && npm run check, then commit");
} else {
  const remaining = cases.filter((c) => /^https?:\/\//.test(String(c.imageUrl || "")) && !covered(c));
  console.log(`cases.json externals still uncovered: ${remaining.length}${REWRITE ? "" : " (dry-run; pass --rewrite to point covered cases at the store)"}`);
}
