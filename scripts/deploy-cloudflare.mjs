#!/usr/bin/env node
/**
 * Deploy `dist/` to the Cloudflare Worker + R2 stack.
 *
 * Replaces the old "push to main -> Vercel builds" path while the Vercel team
 * is blocked (see cf-worker/README notes: Hobby edgeRequest overage pauses the
 * team for 30 days).
 *
 * Object layout produced here must match cf-worker/index.js:
 *   taostudio-site          <dist relative path>            (HTML/JS/CSS/JSON + flat images)
 *   taostudio-cases-assets  prompts/<name>.json             (was public/data/prompts/*)
 *   taostudio-cases-assets  lab-images/**, uploads/**       (served from the assets bucket)
 *   B2 (private, not touched here)  cases/**                (proxied by the Worker)
 *
 * Uploads are incremental: the R2 list gives (ETag, Size); a single-part PUT's
 * ETag is the file's MD5, so we only re-upload objects whose bytes changed.
 *
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * Flags: --dry (report only), --prune (delete R2 objects that dist no longer has)
 */
import { createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// 本地直跑时用仓库 .env.local 兜底（CI 里走 repository secrets）
function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const value = m[2].replace(/^"|"$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
loadDotEnv(join(process.cwd(), ".env.local"));

const ACCOUNT = process.env.R2_ACCOUNT_ID;
const KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET = process.env.R2_SECRET_ACCESS_KEY;
const DIST = process.env.DIST_DIR || "dist";
const SITE_BUCKET = process.env.R2_SITE_BUCKET || "taostudio-site";
const ASSETS_BUCKET = process.env.R2_ASSETS_BUCKET || "taostudio-cases-assets";
const CONCURRENCY = Number(process.env.R2_CONCURRENCY || 24);
const DRY = process.argv.includes("--dry");
const PRUNE = process.argv.includes("--prune");

if (!ACCOUNT || !KEY_ID || !SECRET) {
  console.error("缺少 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY");
  process.exit(1);
}

const HOST = `${ACCOUNT}.r2.cloudflarestorage.com`;
const TYPES = {
  html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8", json: "application/json", webp: "image/webp", png: "image/png",
  jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", avif: "image/avif", svg: "image/svg+xml",
  ico: "image/x-icon", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf",
  txt: "text/plain; charset=utf-8", xml: "application/xml; charset=utf-8", webmanifest: "application/manifest+json",
  map: "application/json", mp4: "video/mp4", pdf: "application/pdf",
};
const contentTypeFor = (f) => TYPES[f.split(".").pop().toLowerCase()] || "application/octet-stream";

const hmac = (key, data) => createHmac("sha256", key).update(data).digest();
const sha256hex = (b) => createHash("sha256").update(b).digest("hex");
const md5hex = (b) => createHash("md5").update(b).digest("hex");
const rfc3986 = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const encodePath = (p) => p.split("/").map(rfc3986).join("/");

function sign(method, canonicalUri, canonicalQuery, extraHeaders, payloadHash, amzDate) {
  const dateStamp = amzDate.slice(0, 8);
  const allHeaders = { host: HOST, ...extraHeaders };
  const names = Object.keys(allHeaders).sort(); // content-type 必须排在 host 之前
  const canonicalHeaders = names.map((n) => `${n}:${allHeaders[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256hex(canonicalRequest)}`;
  const signing = hmac(hmac(hmac(hmac(`AWS4${SECRET}`, dateStamp), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signing).update(stringToSign).digest("hex");
  return {
    amzDate,
    signature: `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function listObjects(bucket) {
  const out = new Map();
  let token = "";
  for (let i = 0; i < 5000; i++) {
    const params = [["list-type", "2"], ["max-keys", "1000"]];
    if (token) params.push(["continuation-token", token]);
    // SigV4 要求 canonical query 按参数名排序，且值与发送时编码完全一致
    params.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const canonicalQuery = params.map(([k, v]) => `${k}=${rfc3986(v)}`).join("&");
    const payloadHash = sha256hex(Buffer.alloc(0));
    const amzDate = amzDateOf();
    const { signature } = sign("GET", `/${bucket}`, canonicalQuery, {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    }, payloadHash, amzDate);
    const res = await fetch(`https://${HOST}/${bucket}?${canonicalQuery}`, {
      headers: { Authorization: signature, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate },
    });
    if (process.env.SIGN_DEBUG) {
      console.log("[debug] host", HOST, "keyIdLen", KEY_ID.length, "secretLen", SECRET.length, "amz", amzDate);
      console.log("[debug] auth", signature.slice(0, 120));
    }
    if (!res.ok) throw new Error(`list ${bucket}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const block = m[1];
      const key = (block.match(/<Key>([^<]*)<\/Key>/) || [, ""])[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
      const etag = (block.match(/<ETag>([^<]*)<\/ETag>/) || [, ""])[1].replace(/&quot;/g, '"').replace(/"/g, "");
      const size = Number((block.match(/<Size>(\d+)<\/Size>/) || [, "0"])[1]);
      out.set(key, { etag, size });
    }
    const next = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/);
    if (!next) break;
    token = next[1].replace(/&amp;/g, "&");
  }
  return out;
}

// list 的 x-amz-date 与签名内的必须一致；单独抽出来避免两次取时间。
function amzDateOf() {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function putObject(bucket, key, body, contentType) {
  const payloadHash = sha256hex(body);
  const canonicalUri = `/${bucket}/${encodePath(key)}`;
  const amzDate = amzDateOf();
  const { signature } = sign("PUT", canonicalUri, "", {
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }, payloadHash, amzDate);
  const res = await fetch(`https://${HOST}${canonicalUri}`, {
    method: "PUT",
    headers: { "Content-Type": contentType, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, Authorization: signature },
    body,
  });
  if (!res.ok) throw new Error(`${key}: ${res.status} ${(await res.text()).slice(0, 160)}`);
}

async function deleteObject(bucket, key) {
  const payloadHash = sha256hex(Buffer.alloc(0));
  const canonicalUri = `/${bucket}/${encodePath(key)}`;
  const amzDate = amzDateOf();
  const { signature } = sign("DELETE", canonicalUri, "", {
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }, payloadHash, amzDate);
  const res = await fetch(`https://${HOST}${canonicalUri}`, {
    method: "DELETE",
    headers: { "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, Authorization: signature },
  });
  if (!res.ok && res.status !== 404) throw new Error(`delete ${key}: ${res.status}`);
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile()) out.push(full);
  }
  return out;
}

const files = walk(DIST);
const rel = files.map((f) => ({ abs: f, key: relative(DIST, f).split(sep).join("/") }));

const siteItems = rel.filter(
  (i) =>
    i.key !== ".build-pass-complete" &&
    !i.key.startsWith("data/prompts/") &&
    !i.key.startsWith("lab-images/") &&
    !i.key.startsWith("uploads/"),
);
const assetItems = [
  ...rel.filter((i) => i.key.startsWith("data/prompts/")).map((i) => ({ ...i, key: i.key.replace(/^data\/prompts\//, "prompts/") })),
  ...rel.filter((i) => i.key.startsWith("lab-images/") || i.key.startsWith("uploads/")),
];

console.log(`dist: ${files.length} files -> site ${siteItems.length} / assets ${assetItems.length}`);

const [siteRemote, assetsRemote] = [await listObjects(SITE_BUCKET), await listObjects(ASSETS_BUCKET)];
console.log(`R2 : site ${siteRemote.size} / assets ${assetsRemote.size} objects`);

function plan(items, remote, prunePrefixes) {
  const uploads = [];
  const unchanged = [];
  for (const item of items) {
    const stat = statSync(item.abs);
    const e = remote.get(item.key);
    if (e && Number(e.size) === stat.size) {
      // 尺寸相同再比 MD5（ETag 对单次 PUT 就是 MD5）
      const body = readFileSync(item.abs);
      if (md5hex(body).toLowerCase() === String(e.etag).toLowerCase()) {
        unchanged.push(item.key);
        continue;
      }
    } else if (e && Number(e.size) !== stat.size) {
      // 尺寸不同，直接重传（省一次读文件）
      uploads.push(item);
      continue;
    }
    uploads.push(item);
  }
  const expected = new Set(items.map((i) => i.key));
  // 只清理"本流水线负责"的前缀，绝不碰桶里其它数据（如 assets 桶的 images/ 图库）
  const prunable = [...remote.keys()].filter(
    (k) => !expected.has(k) && (!prunePrefixes || prunePrefixes.some((p) => k.startsWith(p))),
  );
  return { uploads, unchanged, prunable };
}

const sitePlan = plan(siteItems, siteRemote, null);
const assetPlan = plan(assetItems, assetsRemote, ["prompts/", "lab-images/", "uploads/"]);

console.log(
  `plan: site upload ${sitePlan.uploads.length} (unchanged ${sitePlan.unchanged.length}, prunable ${sitePlan.prunable.length})` +
    ` | assets upload ${assetPlan.uploads.length} (unchanged ${assetPlan.unchanged.length}, prunable ${assetPlan.prunable.length})`,
);

if (DRY) {
  for (const i of sitePlan.uploads.slice(0, 15)) console.log("  would upload site   " + i.key);
  for (const i of assetPlan.uploads.slice(0, 15)) console.log("  would upload assets " + i.key);
  for (const k of sitePlan.prunable.slice(0, 10)) console.log("  would prune  site   " + k);
  for (const k of assetPlan.prunable.slice(0, 10)) console.log("  would prune  assets " + k);
  process.exit(0);
}

const queue = [
  ...sitePlan.uploads.map((i) => ({ bucket: SITE_BUCKET, ...i })),
  ...assetPlan.uploads.map((i) => ({ bucket: ASSETS_BUCKET, ...i })),
];
let ok = 0;
let fail = 0;
let next = 0;
const failures = [];

async function run() {
  for (;;) {
    const i = next++;
    if (i >= queue.length) return;
    const item = queue[i];
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await putObject(item.bucket, item.key, readFileSync(item.abs), contentTypeFor(item.abs));
        ok++;
        break;
      } catch (err) {
        if (attempt === 4) {
          fail++;
          failures.push(`${item.key}: ${String(err.message).slice(0, 120)}`);
        } else {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
    }
    if ((ok + fail) % 2000 === 0) console.log(`uploaded ${ok + fail}/${queue.length} (fail ${fail})`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, run));
console.log(`upload done: ok=${ok} fail=${fail}`);

if (fail) {
  for (const f of failures.slice(0, 10)) console.log("  FAIL " + f);
  process.exit(1);
}

if (PRUNE && (siteItems.length < 20000 || assetItems.length < 15000)) {
  // 构建残缺时绝不清空线上内容（删多了站点直接 404）
  console.error(
    `拒绝清理：产物数量异常（site ${siteItems.length} / assets ${assetItems.length}），疑似构建残缺。先修构建再带 --prune。`,
  );
  process.exit(1);
}

if (PRUNE) {
  const deletions = [
    ...sitePlan.prunable.map((k) => ({ bucket: SITE_BUCKET, key: k })),
    ...assetPlan.prunable.map((k) => ({ bucket: ASSETS_BUCKET, key: k })),
  ];
  for (const d of deletions) {
    try {
      await deleteObject(d.bucket, d.key);
    } catch (e) {
      console.log(`  prune FAIL ${d.key}: ${String(e.message).slice(0, 100)}`);
    }
  }
  console.log(`pruned ${deletions.length} stale objects`);
}
