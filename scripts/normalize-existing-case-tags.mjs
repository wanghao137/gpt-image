/**
 * One-time backfill: apply tag-normalize-core to every row already in
 * public/data/cases.json (rows written before pipeline normalization went
 * live). Idempotent — safe to re-run. Prints per-field change counts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeCaseTags } from "./tag-normalize-core.mjs";

const path = resolve("public/data/cases.json");
const cases = JSON.parse(readFileSync(path, "utf8"));
let touched = 0;
const stats = { styles: 0, scenes: 0, tags: 0 };
const next = cases.map((c) => {
  const out = normalizeCaseTags(c);
  const changed =
    JSON.stringify(out.styles) !== JSON.stringify(c.styles ?? []) ||
    JSON.stringify(out.scenes) !== JSON.stringify(c.scenes ?? []) ||
    JSON.stringify(out.tags) !== JSON.stringify(c.tags ?? []);
  if (!changed) return c;
  touched += 1;
  stats.styles += (c.styles?.length ?? 0) - out.styles.length;
  stats.scenes += (c.scenes?.length ?? 0) - out.scenes.length;
  stats.tags += (c.tags?.length ?? 0) - out.tags.length;
  return { ...c, ...out };
});
// Compact serialization on purpose — matches every other writer of
// public/data/cases.json (sync.mjs writeJson default + migrate-v2.mjs), which
// deliberately keep the prod payload compact ("keeps gzip output smaller").
// Pretty-printing here would reformat the whole ~9 MB file and be reverted by
// the next migrate/sync run.
writeFileSync(path, JSON.stringify(next), "utf8");
console.log(
  `normalize-existing-case-tags: ${touched}/${cases.length} rows updated, removed tokens:`,
  JSON.stringify(stats),
);
