/**
 * Source normalization: apply tag-normalize-core to every row of
 * data/manual/cases.json IN PLACE so the committed manual source matches the
 * canonical tag vocabulary (no Poster/Portrait/Character/Brand/Infographic/
 * Artistic in styles, no Editorial/Artistic in scenes, synonyms collapsed).
 *
 * The PERSISTENT guarantee lives in ingest normalization:
 *   - scripts/sync.mjs `normalizeManualCase` (styles/scenes/tags outputs)
 *   - scripts/migrate-v2.mjs row write (final styles/scenes/tags pass through
 *     normalizeCaseTags before public/data/cases.json is written)
 * This script exists so the already-committed source rows are cleaned once
 * instead of being silently rewritten by the next sync.
 *
 * Idempotent — safe (and expected) to re-run with 0 changes.
 * Formatting: preserves the file's existing style (2-space indent, CRLF,
 * trailing newline; verified round-trip byte-identical). Written via node,
 * never PowerShell, to keep the Chinese copy intact.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeCaseTags } from "./tag-normalize-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const path = resolve(ROOT, "data/manual/cases.json");

const raw = readFileSync(path, "utf8");
const cases = JSON.parse(raw);

// Rows may legitimately omit styles/scenes/tags (the sync loader treats them
// as empty). Only normalize keys that already exist — never add keys, never
// reorder the author's field layout.
let touched = 0;
const stats = { styles: 0, scenes: 0, tags: 0 };
const next = cases.map((c) => {
  const normalized = normalizeCaseTags(c);
  const row = { ...c };
  let changed = false;
  for (const key of ["styles", "scenes", "tags"]) {
    if (!Array.isArray(c[key])) continue;
    if (JSON.stringify(normalized[key]) === JSON.stringify(c[key])) continue;
    stats[key] += c[key].length - normalized[key].length;
    row[key] = normalized[key];
    changed = true;
  }
  if (!changed) return c;
  touched += 1;
  return row;
});

if (touched > 0) {
  // 2-space indent + CRLF + trailing newline — the file's existing style.
  const text = JSON.stringify(next, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  writeFileSync(path, text, "utf8");
}

console.log(
  `normalize-manual-source-tags (${basename(path)}): ${touched}/${cases.length} rows updated, token deltas:`,
  JSON.stringify(stats),
);
