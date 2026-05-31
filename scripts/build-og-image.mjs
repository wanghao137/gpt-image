/**
 * Rasterize public/og.svg → public/og.png (1200×630).
 *
 * WHY: the default social share card was an SVG. WeChat, Twitter/X and several
 * other scrapers do NOT render SVG `og:image`, so first/no-image pages shared
 * out as image-less cards. A baked PNG is universally supported. SEO.tsx
 * prefers og.png when present and falls back to og.svg otherwise.
 *
 * Run: `npm run og` (also safe to run in CI before build).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SVG = resolve(ROOT, "public/og.svg");
const OUT = resolve(ROOT, "public/og.png");

async function main() {
  if (!existsSync(SVG)) {
    console.error("og.svg not found at", SVG);
    process.exit(1);
  }
  const svg = readFileSync(SVG);
  const png = await sharp(svg, { density: 144 })
    .resize(1200, 630, { fit: "cover" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  writeFileSync(OUT, png);
  console.log(`og card: wrote public/og.png (${(png.length / 1024).toFixed(0)} KB) from og.svg`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
