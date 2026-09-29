/**
 * Backblaze B2 store client for baked case-image variants.
 *
 * Why B2 exists here (2026-09-29 CN outage): the gallery's display variants
 * must be reachable from mainland mobile browsers. They are served same-origin
 * through a Vercel proxy rewrite (/images/cases/* → B2 friendly URL), so the
 * browser only ever talks to taostudioai.com; Vercel's edge (US) pulls from
 * B2 on cache misses. B2's free tier (10 GB) holds the full case ladder; the
 * new account is deliberately separate from any other project's account.
 *
 * Env (.env.local / Actions secrets):
 *   B2_STORE_KEY_ID / B2_STORE_APP_KEY — application key scoped to the store
 *                                        bucket (writeFiles + readFiles +
 *                                        listFiles + deleteFiles)
 *   B2_STORE_BUCKET                    — defaults to "taostudio-img"
 *   B2_STORE_REGION                    — S3 endpoint region, e.g. "us-east-005"
 *
 * Store layout (all keys under cases/):
 *   cases/<base>.jpg         — canonical 1200px JPEG (OG card, <img> fallback)
 *   cases/<base>-<w>.webp    — responsive WebP ladder, w ∈ LOCAL_WEBP_WIDTHS
 */
import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "..", ".env.local") });

const ACCOUNT_ID = process.env.B2_STORE_ACCOUNT_ID;
const BUCKET = process.env.B2_STORE_BUCKET || "taostudio-img";
const REGION = process.env.B2_STORE_REGION;
const KEY_ID = process.env.B2_STORE_KEY_ID;
const SECRET = process.env.B2_STORE_APP_KEY;

export const B2_STORE_BUCKET = BUCKET;

/** Absolute friendly URL for a store key (public bucket, no auth needed). */
export function storePublicUrl(key) {
  const base = process.env.B2_STORE_FRIENDLY_BASE || "";
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/file/${BUCKET}/${key}`;
}

export function storeEnvReady() {
  return Boolean(KEY_ID && SECRET && (REGION || ACCOUNT_ID));
}

export function requireStoreEnv() {
  const missing = [
    ["B2_STORE_KEY_ID", KEY_ID],
    ["B2_STORE_APP_KEY", SECRET],
    ["B2_STORE_REGION or B2_STORE_ACCOUNT_ID", REGION || ACCOUNT_ID],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`缺少 B2 store 环境变量: ${missing.join(", ")}（写入 .env.local）`);
  }
}

/** Endpoint prefers the explicit region; falls back to account-id style. */
export function storeClient() {
  requireStoreEnv();
  const endpoint = REGION
    ? `https://s3.${REGION}.backblazeb2.com`
    : `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`.replace(".r2.cloudflarestorage.com", ".backblazeb2.com");
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: KEY_ID, secretAccessKey: SECRET },
  });
}

/** Head one store key; returns {bytes} or null when absent. */
export async function storeHead(client, key) {
  try {
    const r = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { bytes: Number(r.ContentLength || 0) };
  } catch {
    return null;
  }
}

export async function storePut(client, key, body, contentType) {
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

/** Get object bytes; returns Buffer or null when absent. */
export async function storeGet(client, key) {
  try {
    const r = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return Buffer.from(await r.Body.transformToByteArray());
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NoSuchKey") return null;
    throw err;
  }
}
