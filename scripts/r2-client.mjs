/**
 * Cloudflare R2 S3-compatible client for the 4K lab originals.
 *
 * R2 economics (why we migrated, 2026-08-30): 5.74GB sits inside the 10GB
 * free storage tier and egress is free forever — the browsing path already
 * runs on Vercel's free bandwidth (public/lab-images/), so R2 only serves
 * explicit original downloads, which makes it a hard ¥0/month store.
 *
 * Env (.env.local, gitignored):
 *   R2_ACCOUNT_ID       — CF account id; S3 endpoint is
 *                         https://<id>.r2.cloudflarestorage.com
 *   R2_BUCKET           — defaults to "taostudio-lab"
 *   R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY — R2 API token (object read/write)
 *
 * NOTE: R2 ignores per-object ACLs — public reads come from the bucket-level
 * "Public Development URL" (pub-<hash>.r2.dev), not from PutObject params.
 */
import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, HeadBucketCommand, CreateBucketCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "..", ".env.local") });

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET || "taostudio-lab";
const KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET = process.env.R2_SECRET_ACCESS_KEY;

export const R2_BUCKET = BUCKET;

export function requireR2Env() {
  const missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    throw new Error(`缺少 R2 环境变量: ${missing.join(", ")}（写入 .env.local）`);
  }
}

export function r2Client() {
  requireR2Env();
  return new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: KEY_ID, secretAccessKey: SECRET },
  });
}

export async function ensureR2Bucket(client) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return { created: false };
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    return { created: true };
  }
}

/** ETag (md5, unquoted) of the stored object, or null when absent. */
export async function r2HeadEtag(client, key) {
  try {
    const r = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return String(r.ETag || "").replace(/"/g, "");
  } catch {
    return null;
  }
}

export async function r2Put(client, key, body, contentType) {
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function r2Delete(client, key) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export const md5of = (buf) => createHash("md5").update(buf).digest("hex");
