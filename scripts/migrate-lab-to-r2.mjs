/**
 * One-shot migration: upload every lab original from the LOCAL archive to
 * Cloudflare R2 (never via COS — zero migration egress cost), then optionally
 * purge the COS lab/ objects so COS storage fees stop.
 *
 *   node scripts/migrate-lab-to-r2.mjs            # ensure all objects on R2
 *   node scripts/migrate-lab-to-r2.mjs --purge-cos # after R2 verified: delete COS lab/ objects
 *
 * Idempotent: per-object ETag(md5) comparison, safe to re-run; interrupted
 * runs resume automatically. Local sources are located exactly like
 * build-lab-web-images.mjs does (taskId match in the archive).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import COS from "cos-nodejs-sdk-v5";
import {
  R2_BUCKET,
  r2Client,
  ensureR2Bucket,
  r2HeadEtag,
  r2Put,
  md5of,
} from "./r2-client.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadDotenv({ path: resolve(ROOT, ".env.local") });

const ARCHIVE = process.env.LAB_ARCHIVE_DIR;
const LAB_JSON = resolve(ROOT, "data/manual/lab.json");
const CONCURRENCY = Number(process.env.R2_MIGRATE_CONCURRENCY || 4);
const PURGE_COS = process.argv.includes("--purge-cos");

function locateArchiveImage(cosKey) {
  const id = cosKey.split("/").pop().replace(/\.png$/, "");
  for (const name of readdirSync(ARCHIVE)) {
    if (!/^\d{4}-\d{2}-\d{2}_/.test(name)) continue;
    const metaPath = join(ARCHIVE, name, "metadata.json");
    if (!existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf8"));
      if (meta.taskId !== id && meta.taskId !== id.replace(/-\d+$/, "")) continue;
      const idx = id.includes("-") ? Number(id.split("-").pop()) - 1 : 0;
      const file = join(ARCHIVE, name, `image-${idx + 1}.png`);
      return existsSync(file) ? file : null;
    } catch {
      continue;
    }
  }
  return null;
}

async function purgeCos() {
  const cos = new COS({
    SecretId: process.env.COS_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY,
  });
  const call = (fn, p) => new Promise((res, rej) => fn.call(cos, p, (e, d) => (e ? rej(e) : res(d))));
  let deleted = 0;
  let marker;
  for (;;) {
    const list = await call(cos.getBucket, {
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION,
      Prefix: "lab/",
      MaxKeys: 1000,
      ...(marker ? { Marker: marker } : {}),
    });
    const contents = list.Contents || [];
    if (!contents.length) break;
    for (const obj of contents) {
      await call(cos.deleteObject, {
        Bucket: process.env.COS_BUCKET,
        Region: process.env.COS_REGION,
        Key: obj.Key,
      });
      deleted += 1;
      if (deleted % 100 === 0) console.log(`  cos purged ${deleted}…`);
    }
    if (list.IsTruncated !== "true") break;
    marker = contents[contents.length - 1].Key;
  }
  console.log(`COS lab/ 清理完成：删除 ${deleted} 个对象（存储费归零）。`);
}

async function main() {
  if (!existsSync(LAB_JSON)) throw new Error("data/manual/lab.json 不存在");
  const items = JSON.parse(readFileSync(LAB_JSON, "utf8")).filter((i) => !i.hidden);
  if (!ARCHIVE || !existsSync(ARCHIVE)) throw new Error(`LAB_ARCHIVE_DIR 不可用: ${ARCHIVE}`);

  const client = r2Client();
  const bucketInfo = await ensureR2Bucket(client);
  console.log(`R2 桶 ${R2_BUCKET} ${bucketInfo.created ? "已创建" : "已存在"}；迁移 ${items.length} 条（本地直传，零 COS 流量）`);

  let uploaded = 0;
  let unchanged = 0;
  let failed = 0;
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx];
      try {
        const src = locateArchiveImage(item.cosKey);
        if (!src) throw new Error("本地档案未找到");
        const buf = readFileSync(src);
        const remote = await r2HeadEtag(client, item.cosKey);
        if (remote === md5of(buf)) {
          unchanged += 1;
        } else {
          await r2Put(client, item.cosKey, buf, "image/png");
          uploaded += 1;
        }
        if ((uploaded + unchanged) % 50 === 0) {
          console.log(`  … ${uploaded + unchanged}/${items.length}`);
        }
      } catch (e) {
        failed += 1;
        console.error(`  FAILED ${item.id}: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`R2 迁移完成：上传 ${uploaded}、已存在 ${unchanged}、失败 ${failed}。`);
  if (failed > 0) process.exitCode = 1;

  if (PURGE_COS) {
    if (failed > 0) {
      console.error("存在失败对象，跳过 COS 清理（重跑补齐后再清）。");
      process.exitCode = 1;
      return;
    }
    await purgeCos();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
