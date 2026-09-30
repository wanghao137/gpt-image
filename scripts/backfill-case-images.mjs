/**
 * Backfill driver for the case-image store (see workflows/backfill-case-images.yml).
 *
 * Selects the next unbaked slice of external cases within the requested range,
 * capped by --limit, then runs `build-images.mjs --store` with IMAGE_SLICE so
 * the main pipeline only considers those records. Resume-safe: the store
 * manifest short-circuits already-baked bases, so repeated runs converge.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const CASES_PATH = "public/data/cases.json";
const MANIFEST_PATH = "data/image-store.json";

const cases = JSON.parse(readFileSync(CASES_PATH, "utf8"));
const manifest = existsSync(MANIFEST_PATH)
  ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
  : { entries: {} };

const start = Number(process.env.BACKFILL_RANGE_START || 0) || 0;
const endRaw = process.env.BACKFILL_RANGE_END || "";
const end = endRaw ? Number(endRaw) : cases.length;
const limit = Number(process.env.BACKFILL_LIMIT || 400) || 400;

const externalIdx = [];
for (const [idx, c] of cases.entries()) {
  if (idx < start || idx >= end) continue;
  if (!/^https?:\/\//i.test(String(c.imageUrl || ""))) continue;
  const base = `case${c.id}`;
  const entry = manifest.entries?.[base];
  if (entry && entry.source !== "failed") continue; // already baked
  externalIdx.push(idx);
}

if (!externalIdx.length) {
  // Range exhausted: arm the gate. "partial" keeps failed-marked externals
  // allowed (retryable); true means zero failures — strict mode.
  const failed = Object.values(manifest.entries || {}).filter((e) => e && e.source === "failed").length;
  if (!manifest.completed || manifest.completed !== true) {
    const next = { ...manifest, completed: failed === 0 ? true : "partial" };
    writeFileSync(MANIFEST_PATH, JSON.stringify(next));
    console.log(`backfill: range drained — manifest.completed=${JSON.stringify(next.completed)} (failed=${failed})`);
  } else {
    console.log("backfill: nothing to bake in range — already drained and complete.");
  }
  process.exit(0);
}

const selected = externalIdx.slice(0, limit);
const sliceStart = selected[0];
const sliceEnd = selected[selected.length - 1] + 1;

console.log(
  `backfill: ${externalIdx.length} unbaked externals in [${start},${end}); ` +
    `this run bakes ${selected.length} via IMAGE_SLICE=${sliceStart},${sliceEnd}`,
);

const child = spawnSync("node", ["scripts/build-images.mjs", "--store"], {
  stdio: "inherit",
  env: {
    ...process.env,
    IMAGE_SLICE: `${sliceStart},${sliceEnd}`,
  },
});
process.exit(child.status ?? 1);
