/**
 * Idempotent 4K-lab importer — scans the local generation archive, uploads new
 * originals to Tencent COS HK, and appends registry entries to
 * data/manual/lab.json.
 *
 *   node scripts/import-lab.mjs --doctor   # prereq check: keys/bucket/public-read chain
 *   node scripts/import-lab.mjs --dry-run  # list what WOULD be imported, zero writes
 *   node scripts/import-lab.mjs            # upload new + merge-write lab.json
 *
 * Idempotency: registry diff by id (existing entries are never touched), plus
 * per-object ETag check so interrupted runs re-upload only missing/differing
 * objects. Every uploaded object is anonymously HEAD-verified as public-read;
 * ANY failure → non-zero exit and lab.json is NOT written.
 *
 * Scope guard: only archive-root folders matching the generation naming
 * convention are scanned (never recursive — the archive root also holds
 * ~200GB of content-collection working dirs), and sticker folders
 * (params.transparent_output === true) are skipped entirely.
 *
 * Env (from .env.local, gitignored — secrets never enter the repo):
 *   COS_BUCKET / COS_REGION / COS_SECRET_ID / COS_SECRET_KEY / LAB_ARCHIVE_DIR
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import COS from "cos-nodejs-sdk-v5";
import sharp from "sharp";
import { mergeLabEntries, parseArchiveFolder } from "./lab-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadDotenv({ path: resolve(ROOT, ".env.local") });

const BUCKET = process.env.COS_BUCKET;
const REGION = process.env.COS_REGION;
const ARCHIVE = process.env.LAB_ARCHIVE_DIR;
const LAB_JSON = resolve(ROOT, "data/manual/lab.json");
const args = new Set(process.argv.slice(2));

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});
const call = (fn, params) =>
  new Promise((res, rej) => fn.call(cos, params, (e, d) => (e ? rej(e) : res(d))));
const md5 = (buf) => createHash("md5").update(buf).digest("hex");
const publicUrl = (key) => `https://${BUCKET}.cos.${REGION}.myqcloud.com/${key}`;

function requireEnv() {
  const missing = ["COS_BUCKET", "COS_REGION", "COS_SECRET_ID", "COS_SECRET_KEY", "LAB_ARCHIVE_DIR"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    console.error(`缺少环境变量: ${missing.join(", ")}（写入 .env.local）`);
    process.exit(1);
  }
  if (!existsSync(ARCHIVE)) {
    console.error(`LAB_ARCHIVE_DIR 不存在: ${ARCHIVE}`);
    process.exit(1);
  }
}

async function doctor() {
  await call(cos.headBucket, { Bucket: BUCKET, Region: REGION });
  console.log("1. headBucket PASS（密钥有效，桶可访问）");
  const Key = "lab/_doctor_probe.txt";
  await call(cos.putObject, {
    Bucket: BUCKET,
    Region: REGION,
    Key,
    Body: "probe",
    ContentType: "text/plain",
    ACL: "public-read",
  });
  console.log("2. putObject+public-read PASS");
  const r = await fetch(publicUrl(Key));
  if (!(r.status === 200 && (await r.text()) === "probe")) {
    throw new Error(`匿名读失败 status=${r.status}`);
  }
  console.log("3. anonymous GET PASS（公读链路通）");
  await call(cos.deleteObject, { Bucket: BUCKET, Region: REGION, Key });
  console.log("4. cleanup PASS — doctor 全绿");
}

/**
 * Actual-pixel transparency check. The metadata flag
 * (params.transparent_output) is UNRELIABLE — verified 2026-08-29: two
 * "Meme sticker pack" generations carry transparent pixels but were flagged
 * false by the generator. So sticker exclusion runs on the real alpha
 * channel: an image with any meaningfully transparent pixel (alpha min <
 * 250) is treated as the sticker lane and skipped. ~0.5s per image.
 */
async function isTransparentImage(file) {
  try {
    const image = sharp(file);
    const md = await image.metadata();
    if (!md.hasAlpha) return false;
    const st = await image.stats();
    const alpha = st.channels[st.channels.length - 1];
    return Number.isFinite(alpha?.min) && alpha.min < 250;
  } catch {
    // Unreadable image → let the uploader surface the real error later.
    return false;
  }
}

function scanArchive() {
  const out = [];
  let transparent = 0;
  for (const name of readdirSync(ARCHIVE)) {
    const dir = join(ARCHIVE, name);
    let st;
    try {
      st = statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const metaPath = join(dir, "metadata.json");
    if (!existsSync(metaPath)) continue;
    let meta;
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8"));
    } catch {
      console.warn(`跳过（元数据损坏）: ${name}`);
      continue;
    }
    const { entries, skip } = parseArchiveFolder(name, meta);
    if (skip === "transparent") {
      transparent += 1;
      continue;
    }
    if (skip) continue;
    for (let i = 0; i < entries.length; i++) {
      const file = join(dir, meta.images?.[i]?.file ?? `image-${i + 1}.png`);
      if (!existsSync(file)) {
        console.warn(`跳过（图片缺失）: ${file}`);
        continue;
      }
      out.push({ entry: entries[i], file });
    }
  }
  if (transparent > 0) console.log(`跳过表情包（metadata 标记） ${transparent} 个文件夹`);
  return out;
}

async function filterTransparent(candidates) {
  const kept = [];
  let alphaSkipped = 0;
  for (const c of candidates) {
    if (await isTransparentImage(c.file)) {
      alphaSkipped += 1;
      console.log(`跳过（实际像素透明，表情包通道）: ${c.entry.title}  → ${c.entry.cosKey}`);
      continue;
    }
    kept.push(c);
  }
  if (alphaSkipped > 0) console.log(`alpha 实测排除 ${alphaSkipped} 张（metadata 标记不可信，见函数注释）`);
  return kept;
}

async function run() {
  const existing = existsSync(LAB_JSON) ? JSON.parse(readFileSync(LAB_JSON, "utf8")) : [];
  if (!Array.isArray(existing)) {
    console.error("data/manual/lab.json 已存在但不是数组——中止。");
    process.exit(1);
  }
  const known = new Set(existing.map((e) => e.id));
  let candidates = scanArchive().filter((c) => !known.has(c.entry.id));
  console.log(`档案候选 ${candidates.length} 条（已登记 ${existing.length} 条自动跳过）`);
  candidates = await filterTransparent(candidates);
  if (candidates.length === 0) {
    console.log("无新增。");
    return;
  }
  if (args.has("--dry-run")) {
    for (const { entry } of candidates) {
      console.log(
        `  ${entry.createdAt.slice(0, 10)}  ${String(entry.width).padStart(4)}x${String(entry.height).padEnd(4)}  ${entry.title}  → ${entry.cosKey}`,
      );
    }
    console.log(`dry-run：共 ${candidates.length} 条，未做任何写入。`);
    return;
  }

  // Concurrent upload pool. Single-stream COS PUT leaves home upstream
  // bandwidth unused (~0.6MB/s observed); 4 workers saturate it. Order is
  // irrelevant — failure semantics stay the same (any fail → no lab.json).
  const CONCURRENCY = Math.max(1, Number(process.env.LAB_IMPORT_CONCURRENCY || 4));
  let uploaded = 0;
  let unchanged = 0;
  let failed = 0;
  const newEntries = [];
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= candidates.length) return;
      const { entry, file } = candidates[idx];
      const buf = readFileSync(file);
      // ETag = md5 for single-part uploads. Multipart-pushed objects (or
      // another writer) produce a different ETag → treated as changed and
      // re-uploaded. Safe + idempotent.
      const remote = await call(cos.headObject, { Bucket: BUCKET, Region: REGION, Key: entry.cosKey }).catch(
        () => null,
      );
      const remoteEtag = remote?.headers?.etag?.replace(/"/g, "");
      if (remote && remoteEtag === md5(buf)) {
        newEntries.push(entry);
        unchanged += 1;
        console.log(`  已存在  ${entry.cosKey}`);
        continue;
      }
      try {
        await call(cos.putObject, {
          Bucket: BUCKET,
          Region: REGION,
          Key: entry.cosKey,
          Body: buf,
          ContentType: "image/png",
          ContentLength: buf.length,
          ACL: "public-read",
          CacheControl: "public, max-age=31536000, immutable",
        });
        const check = await fetch(publicUrl(entry.cosKey), { method: "HEAD" });
        if (check.status !== 200) throw new Error(`匿名 HEAD status=${check.status}`);
        newEntries.push(entry);
        uploaded += 1;
        console.log(
          `  上传    ${entry.cosKey}  ${(buf.length / 1048576).toFixed(1)}MB  ${entry.title}`,
        );
      } catch (e) {
        failed += 1;
        console.error(`  FAILED  ${entry.cosKey}: ${e.message || e}`);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, () => worker()),
  );
  if (failed > 0) {
    console.error(`${failed} 条失败，lab.json 未写入（重跑只补缺）。`);
    process.exit(1);
  }
  const merged = mergeLabEntries(existing, newEntries);
  writeFileSync(LAB_JSON, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(
    `完成：上传 ${uploaded}、远端已存在 ${unchanged}、lab.json 共 ${merged.length} 条。`,
  );
}

if (args.has("--doctor")) {
  requireEnv();
  doctor().catch((e) => {
    console.error("doctor FAIL:", e.message || e);
    process.exit(1);
  });
} else {
  requireEnv();
  run().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
