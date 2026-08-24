#!/usr/bin/env node
// Generates crawlable meta pages for every case slug that vite-react-ssg did
// NOT prerender. Runs in postbuild (after sitemap), reads the fresh spa shell
// from dist/, and writes ONLY into dist/ — these are deploy artifacts, never
// committed sources.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCaseMetaHtml } from "./case-meta-pages-core.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");

const spaPath = resolve(DIST, "spa", "index.html");
if (!existsSync(spaPath)) {
  console.error(`✗ ${spaPath} not found — run after vite-react-ssg build.`);
  process.exit(1);
}
const spaHtml = readFileSync(spaPath, "utf8");

const rows = JSON.parse(readFileSync(resolve(ROOT, "public", "data", "cases.json"), "utf8"));
if (!Array.isArray(rows)) {
  console.error("✗ public/data/cases.json is not an array");
  process.exit(1);
}

const prerendered = new Set();
const caseDir = resolve(DIST, "case");
if (existsSync(caseDir)) {
  for (const entry of readdirSync(caseDir, { withFileTypes: true })) {
    if (entry.isDirectory()) prerendered.add(entry.name);
    else if (entry.isFile() && entry.name.endsWith(".html")) {
      prerendered.add(entry.name.replace(/\.html$/, ""));
    }
  }
}

let written = 0;
let alreadyRich = 0;
let skipped = 0;
for (const row of rows) {
  const slug = typeof row?.slug === "string" ? row.slug.trim() : "";
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    skipped += 1;
    continue;
  }
  if (prerendered.has(slug)) {
    alreadyRich += 1;
    continue;
  }
  const html = buildCaseMetaHtml({ spaHtml, row });
  if (!html) {
    skipped += 1;
    continue;
  }
  const out = resolve(caseDir, `${slug}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  written += 1;
}

console.log(
  `✓ case meta pages: ${written} written, ${alreadyRich} already prerendered, ` +
    `${skipped} skipped (missing/unsafe slug or title)`,
);
