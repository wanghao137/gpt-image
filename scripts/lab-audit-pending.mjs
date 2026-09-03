/**
 * Adversarial pre-import audit for the 4K lab (one-off helper, 2026-08-31).
 *
 * Scans the archive for entries NOT yet in data/manual/lab.json and reports:
 *   - full detail per candidate (date/dims/size/transparent flag/prompt)
 *   - intra-batch byte-identical duplicate groups (retry folders)
 *   - cross-batch duplicates against already-registered entries
 *   - candidates whose prompt text carries explicit adult keywords
 *     (text-level gate only — images are not visually inspected)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ARCHIVE = process.env.LAB_ARCHIVE_DIR || "F:/gpt生图/4K";
const LAB_JSON = new URL("../data/manual/lab.json", import.meta.url);

const registered = JSON.parse(readFileSync(LAB_JSON, "utf8"));
const known = new Set(registered.map((i) => i.id));

// one sha per archive image file (lazily hashed, single pass)
const shaOf = (p) => {
  try {
    return createHash("sha1").update(readFileSync(p)).digest("hex").slice(0, 12);
  } catch {
    return null;
  }
};

const scan = () => {
  const rows = [];
  for (const name of readdirSync(ARCHIVE)) {
    if (!/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_/.test(name)) continue;
    const dir = join(ARCHIVE, name);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    let meta;
    try {
      meta = JSON.parse(readFileSync(join(dir, "metadata.json"), "utf8"));
    } catch {
      continue;
    }
    const imgs = Array.isArray(meta.images) && meta.images.length ? meta.images : [{}];
    imgs.forEach((im, i) => {
      const id = i > 0 ? `${meta.taskId}-${i + 1}` : meta.taskId;
      const file = join(dir, im.file || `image-${i + 1}.png`);
      rows.push({
        id,
        registered: known.has(id),
        date: String(meta.createdAt || "").slice(0, 10),
        dims: `${meta.actualSize?.width ?? im.width ?? "?"}x${meta.actualSize?.height ?? im.height ?? "?"}`,
        tr: meta.params?.transparent_output === true,
        sha: shaOf(file),
        prompt: String(meta.prompt || "").replace(/\s+/g, " ").slice(0, 160),
      });
    });
  }
  return rows;
};

const rows = scan();
const pending = rows.filter((r) => !r.registered);
const knownShas = new Set(rows.filter((r) => r.registered && r.sha).map((r) => r.sha));

// intra-batch duplicate groups
const bySha = new Map();
for (const r of pending) {
  if (!r.sha) continue;
  bySha.set(r.sha, [...(bySha.get(r.sha) || []), r.id]);
}
const dupGroups = [...bySha.entries()].filter(([, ids]) => ids.length > 1);
const crossDup = pending.filter((r) => knownShas.has(r.sha)).map((r) => r.id);

// text-level adult keyword gate (explicit terms only — not fashion/portrait)
const ADULT_RE = /\b(nude|naked|nsfw|topless|nipples?|explicit sex|porn)\b|裸体|全裸|露点/i;
const flagged = pending.filter((r) => ADULT_RE.test(r.prompt));

console.log(`档案总行: ${rows.length} | 已登记: ${rows.length - pending.length} | 待入库候选: ${pending.length}`);
console.log(`同批字节级重复组: ${dupGroups.length}（${dupGroups.reduce((n, [, v]) => n + v.length - 1, 0)} 个多余副本）`);
dupGroups.forEach(([s, v]) => console.log(`  DUP ${s} ${v.join(" | ")}`));
console.log(`跨批重复(与已入库同内容): ${crossDup.length} ${crossDup.join(", ")}`);
console.log(`文本级成人词命中(需人工把关): ${flagged.length} ${flagged.map((r) => r.id).join(", ")}`);
console.log("=== 待入库明细 ===");
for (const r of pending) {
  console.log(
    `${r.date} ${r.dims.padEnd(10)} ${r.tr ? "[透明标记]" : "        "} ${r.id} ${r.sha} | ${r.prompt}`,
  );
}
