/**
 * ONE-TIME historical backfill for rows already written to public/data before
 * text hygiene went live at ingest: junk titles ("提示词：" …), promptPreview
 * "null", CJK titleEn. The PERSISTENT guarantee lives in ingest normalization
 * (sync.mjs `normalizeCase` applies the same case-text-hygiene-core guards to
 * every incoming row). Do NOT run this as part of the daily pipeline.
 * Idempotent; prints per-field change counts.
 *
 * Output stays COMPACT (`JSON.stringify(next)`, no trailing newline) to match
 * the existing writers of public/data/cases.json (sync.mjs writeJson).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanText,
  normalizeCaseTitle,
  sanitizeTitleEn,
} from "./case-text-hygiene-core.mjs";

const path = resolve("public/data/cases.json");
const cases = JSON.parse(readFileSync(path, "utf8"));
const stats = { title: 0, titleEn: 0, promptPreview: 0, imageAlt: 0 };
const next = cases.map((c) => {
  const row = { ...c };
  const title = normalizeCaseTitle(row.title, row.titleEn ?? "") || `案例 ${row.id}`;
  if (title !== row.title) {
    row.title = title;
    stats.title += 1;
  }
  const titleEn = sanitizeTitleEn(row.titleEn, row.title);
  if (titleEn !== row.titleEn) {
    if (titleEn === undefined) delete row.titleEn;
    else row.titleEn = titleEn;
    stats.titleEn += 1;
  }
  // Junk previews become "" (matches sync-side fallback); "" must map to ""
  // so repeated runs report zero changes.
  const nextPreview = cleanText(row.promptPreview) ?? "";
  if (nextPreview !== row.promptPreview) {
    row.promptPreview = nextPreview;
    stats.promptPreview += 1;
  }
  const alt = cleanText(row.imageAlt);
  if (alt === undefined && row.imageAlt !== undefined) {
    row.imageAlt = row.title;
    stats.imageAlt += 1;
  }
  return row;
});
writeFileSync(path, JSON.stringify(next), "utf8");
console.log(`fix-legacy-case-text: changed rows by field:`, JSON.stringify(stats));
