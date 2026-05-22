import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE =
  "F:/gpt\u751f\u56fe/ChatGPT Image 2026\u5e745\u670822\u65e5 17_18_34.png";
const SOURCE = process.argv[2] || DEFAULT_SOURCE;
const BRAND_DIR = resolve(ROOT, "public/brand");
const BRAND_NAME = "\u6843\u5b50AI\u89c6\u89c9\u5b9e\u9a8c\u5ba4";
const SIZES = [16, 32, 64, 128, 180, 256, 512];

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function median(values) {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

function distance(r, g, b, bg) {
  return Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
}

function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function estimateBackground(data, width, height, channels) {
  const sample = Math.min(48, Math.floor(Math.min(width, height) / 4));
  const rs = [];
  const gs = [];
  const bs = [];
  const corners = [
    [0, 0],
    [width - sample, 0],
    [0, height - sample],
    [width - sample, height - sample],
  ];

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sample; y += 1) {
      for (let x = startX; x < startX + sample; x += 1) {
        const i = (y * width + x) * channels;
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
    }
  }

  return [median(rs), median(gs), median(bs)];
}

function buildTransparentCutout(data, info, bg) {
  const { width, height, channels } = info;
  const total = width * height;
  const candidate = new Uint8Array(total);
  const background = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isCandidate = (index) => {
    const i = index * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const d = distance(r, g, b, bg);
    const s = saturation(r, g, b);
    const max = Math.max(r, g, b);
    return (d < 38 && s < 0.11 && max > 226) || (d < 22 && max > 218);
  };

  for (let index = 0; index < total; index += 1) {
    candidate[index] = isCandidate(index) ? 1 : 0;
  }

  const enqueue = (index) => {
    if (!candidate[index] || background[index]) return;
    background[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y < height - 1) enqueue(index + width);
  }

  const out = Buffer.alloc(total * 4);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let index = 0; index < total; index += 1) {
    const src = index * channels;
    const dst = index * 4;
    const r = data[src];
    const g = data[src + 1];
    const b = data[src + 2];

    let alpha = 255;
    if (background[index]) {
      const d = distance(r, g, b, bg);
      alpha = clampByte(((d - 14) / 22) * 255);
      if (alpha < 10) alpha = 0;
    }

    if (alpha === 0) {
      out[dst] = 0;
      out[dst + 1] = 0;
      out[dst + 2] = 0;
    } else if (alpha < 255) {
      const a = alpha / 255;
      out[dst] = clampByte((r - bg[0] * (1 - a)) / a);
      out[dst + 1] = clampByte((g - bg[1] * (1 - a)) / a);
      out[dst + 2] = clampByte((b - bg[2] * (1 - a)) / a);
    } else {
      out[dst] = r;
      out[dst + 1] = g;
      out[dst + 2] = b;
    }
    out[dst + 3] = alpha;

    if (alpha > 16) {
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX > maxX || minY > maxY) {
    throw new Error("No foreground pixels found while building logo cutout.");
  }

  return { data: out, info: { width, height, channels: 4 }, bounds: { minX, minY, maxX, maxY } };
}

async function main() {
  mkdirSync(BRAND_DIR, { recursive: true });

  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const bg = estimateBackground(data, info.width, info.height, info.channels);
  const cutout = buildTransparentCutout(data, info, bg);

  const { minX, minY, maxX, maxY } = cutout.bounds;
  const usedWidth = maxX - minX + 1;
  const usedHeight = maxY - minY + 1;
  const side = Math.ceil(Math.max(usedWidth, usedHeight) * 1.16);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const left = Math.max(0, Math.round(centerX - side / 2));
  const top = Math.max(0, Math.round(centerY - side / 2));

  const master = sharp(cutout.data, { raw: cutout.info }).extract({
    left,
    top,
    width: Math.min(side, info.width - left),
    height: Math.min(side, info.height - top),
  });

  const buffers = new Map();
  for (const size of SIZES) {
    const buffer = await master
      .clone()
      .resize(size, size, { fit: "contain", kernel: "lanczos3" })
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer();
    buffers.set(size, buffer);
    writeFileSync(resolve(BRAND_DIR, `taostudio-peach-logo-${size}.png`), buffer);
  }

  writeFileSync(resolve(ROOT, "public/favicon-16x16.png"), buffers.get(16));
  writeFileSync(resolve(ROOT, "public/favicon-32x32.png"), buffers.get(32));
  writeFileSync(resolve(ROOT, "public/apple-touch-icon.png"), buffers.get(180));

  const faviconPng = buffers.get(512).toString("base64");
  writeFileSync(
    resolve(ROOT, "public/favicon.svg"),
    `<svg id="taostudio-peach-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <title>${BRAND_NAME}</title>
  <image href="data:image/png;base64,${faviconPng}" width="512" height="512" preserveAspectRatio="xMidYMid meet" />
</svg>
`,
    "utf8",
  );

  console.log(
    `brand assets: ${SIZES.length} transparent PNGs, favicon PNGs and favicon.svg from ${SOURCE}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
