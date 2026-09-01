/**
 * Bake browse-grade WebP variants for the 4K lab into the repo (Vercel's
 * free bandwidth serves them), so COS only pays for explicit original
 * downloads.
 *
 * Motivation (2026-08-30 cost incident): every card/detail/og/lightbox image
 * was an imageMogr2 URL on COS HK. Bots crawled all 517 new pages and pulled
 * ~2GB/day of billable egress + image-processing fees ≈ ¥1/day. After this
 * script the ENTIRE browsing path is same-origin static files; COS traffic
 * happens only when a user clicks 下载 4K 原图.
 *
 * Emits per registry entry (id from lab.json; images are read from the LOCAL
 * archive — zero COS traffic):
 *   public/lab-images/<id>-480.webp   card thumbnails (~60-90KB)
 *   public/lab-images/<id>-1600.webp  detail + lightbox (~300-380KB)
 *
 * Idempotent: skips files whose mtime is newer than the source image.
 * Usage: node scripts/build-lab-web-images.mjs [--force]
 *
 * CI-safe no-op: without a local archive (LAB_ARCHIVE_DIR unset/missing —
 * e.g. GitHub Pages / fresh clones) the script exits 0 immediately; the
 * committed public/lab-images WebPs ARE the served artifacts, so a build
 * must never fail just because it cannot re-bake them (2026-08-30+ Pages
 * deploy outage: 514/514 MISSING-SOURCE → exit 1 on every push).
 */
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadDotenv({ path: resolve(ROOT, ".env.local") });

const ARCHIVE = process.env.LAB_ARCHIVE_DIR;
const LAB_JSON = resolve(ROOT, "data/manual/lab.json");
const OUT_DIR = resolve(ROOT, "public/lab-images");
const FORCE = process.argv.includes("--force");
const CONCURRENCY = 4;

const CARD_W = 480;
const DETAIL_W = 1600;

function locateArchiveImage(cosKey) {
  if (!ARCHIVE || !existsSync(ARCHIVE)) return null;
  // cosKey = lab/yyyy/mm/<id>.png → <id>.png; find matching generation folder.
  const idFile = cosKey.split("/").pop();
  const id = idFile.replace(/\.png$/, "");
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

async function bake(entry) {
  const src = locateArchiveImage(entry.cosKey);
  if (!src) {
    console.warn(`  MISSING-SOURCE ${entry.id}（本地档案找不到，跳过——R2 原图回退）`);
    return { id: entry.id, ok: false, reason: "no-source" };
  }
  const cardPath = resolve(OUT_DIR, `${entry.id}-${CARD_W}.webp`);
  const detailPath = resolve(OUT_DIR, `${entry.id}-${DETAIL_W}.webp`);
  const srcMtime = statSync(src).mtimeMs;
  const needs = (p) => FORCE || !existsSync(p) || statSync(p).mtimeMs < srcMtime;
  try {
    if (needs(cardPath)) {
      await sharp(src).resize({ width: CARD_W, withoutEnlargement: true }).webp({ quality: 78 }).toFile(cardPath);
    }
    if (needs(detailPath)) {
      await sharp(src).resize({ width: DETAIL_W, withoutEnlargement: true }).webp({ quality: 82 }).toFile(detailPath);
    }
    return { id: entry.id, ok: true };
  } catch (e) {
    console.warn(`  FAILED ${entry.id}: ${e.message}`);
    return { id: entry.id, ok: false, reason: e.message };
  }
}

async function main() {
  if (!ARCHIVE || !existsSync(ARCHIVE)) {
    console.log(
      "lab-web-images: LAB_ARCHIVE_DIR 未配置或不存在，跳过烘焙（构建直接使用仓库内已提交的 public/lab-images 资产）。",
    );
    return;
  }
  const items = existsSync(LAB_JSON) ? JSON.parse(readFileSync(LAB_JSON, "utf8")) : [];
  const visible = items.filter((i) => !i.hidden);
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`lab-web-images: baking ${CARD_W}px + ${DETAIL_W}px WebP for ${visible.length} entries → public/lab-images/`);

  let done = 0;
  let failed = 0;
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= visible.length) return;
      const r = await bake(visible[idx]);
      done += 1;
      if (!r.ok) failed += 1;
      if (done % 50 === 0) console.log(`  … ${done}/${visible.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`完成：${done} 条，失败 ${failed}（失败条目运行时回退 R2 原图）。`);
  if (failed > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
