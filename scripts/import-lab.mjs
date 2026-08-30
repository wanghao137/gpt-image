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
 * (params.transparent_output === true, plus real-pixel alpha detection —
 * the metadata flag proved unreliable) are skipped entirely.
 *
 * Storage: Cloudflare R2 (2026-08-30, S3-compatible; free tier covers the
 * whole archive and egress is free forever). Before that: Tencent COS HK.
 *
 * Env (from .env.local, gitignored — secrets never enter the repo):
 *   R2_ACCOUNT_ID / R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY /
 *   LAB_ARCHIVE_DIR
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import sharp from "sharp";
import {
  R2_BUCKET,
  r2Client,
  ensureR2Bucket,
  r2HeadEtag,
  r2Put,
  r2Delete,
  md5of,
} from "./r2-client.mjs";
import { R2_PUBLIC_BASE } from "../src/lib/lab-cos-core.mjs";
import { mergeLabEntries, parseArchiveFolder } from "./lab-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadDotenv({ path: resolve(ROOT, ".env.local") });

const ARCHIVE = process.env.LAB_ARCHIVE_DIR;
const LAB_JSON = resolve(ROOT, "data/manual/lab.json");
const args = new Set(process.argv.slice(2));

const client = r2Client();

function requireEnv() {
  // R2 credentials are validated by r2Client(); here we only check the archive.
  if (!ARCHIVE || !existsSync(ARCHIVE)) {
    console.error(`LAB_ARCHIVE_DIR 不存在: ${ARCHIVE}`);
    process.exit(1);
  }
}

async function doctor() {
  requireEnv();
  const info = await ensureR2Bucket(client);
  console.log(`1. R2 桶 ${R2_BUCKET} ${info.created ? "已创建" : "可访问"} PASS`);
  const Key = "lab/_doctor_probe.txt";
  await r2Put(client, Key, "probe", "text/plain");
  console.log("2. putObject PASS");
  if (R2_PUBLIC_BASE) {
    const r = await fetch(`${R2_PUBLIC_BASE}/${Key}`);
    if (!(r.status === 200 && (await r.text()) === "probe")) {
      throw new Error(`匿名读失败 status=${r.status}（检查桶的 Public Development URL 是否开启）`);
    }
    console.log("3. anonymous GET PASS（公开读链路通）");
  } else {
    console.log("3. 匿名读验证跳过（lab-cos-core 的 R2_PUBLIC_BASE 未配置——桶公开 URL 确定后填入再验）");
  }
  await r2Delete(client, Key);
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
      // ETag = md5 for R2 single-part puts. Mismatch/absence → (re)upload.
      const remote = await r2HeadEtag(client, entry.cosKey);
      if (remote === md5of(buf)) {
        newEntries.push(entry);
        unchanged += 1;
        console.log(`  已存在  ${entry.cosKey}`);
        continue;
      }
      try {
        await r2Put(client, entry.cosKey, buf, "image/png");
        if (R2_PUBLIC_BASE) {
          const check = await fetch(`${R2_PUBLIC_BASE}/${entry.cosKey}`, { method: "HEAD" });
          if (check.status !== 200) throw new Error(`匿名 HEAD status=${check.status}`);
        }
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
