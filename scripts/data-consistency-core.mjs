import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const RESERVED_CASE_FILES = new Set([
  "cases.json",
  "cases-home.json",
  "cases-index.json",
  "cases-search.json",
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function idOf(value) {
  return String(value?.id ?? "").trim();
}

function uniqueIds(records, label) {
  if (!Array.isArray(records)) {
    throw new Error(`[data-consistency] ${label} must be an array`);
  }

  const ids = new Set();
  for (const [index, record] of records.entries()) {
    const id = idOf(record);
    if (!id) {
      throw new Error(`[data-consistency] ${label}[${index}] is missing an id`);
    }
    if (ids.has(id)) {
      throw new Error(`[data-consistency] ${label} contains duplicate id ${id}`);
    }
    ids.add(id);
  }
  return ids;
}

function formatSample(values) {
  return values.slice(0, 10).join(", ") + (values.length > 10 ? ", …" : "");
}

function compareIdSets(sourceIds, candidateIds, label) {
  const missing = Array.from(sourceIds).filter((id) => !candidateIds.has(id));
  const extra = Array.from(candidateIds).filter((id) => !sourceIds.has(id));
  if (missing.length === 0 && extra.length === 0) return;

  const details = [];
  if (missing.length > 0) details.push(`missing ${missing.length}: ${formatSample(missing)}`);
  if (extra.length > 0) details.push(`extra ${extra.length}: ${formatSample(extra)}`);
  throw new Error(`[data-consistency] ${label} differs from cases.json (${details.join("; ")})`);
}

export function validateGeneratedData({
  sourceCases,
  home,
  index,
  search,
  categoryShards,
  browseManifest,
  browsePages,
}) {
  const sourceIds = uniqueIds(sourceCases, "cases.json");
  const indexIds = uniqueIds(index, "cases-index.json");
  const searchIds = uniqueIds(search, "cases-search.json");

  compareIdSets(sourceIds, indexIds, "cases-index.json");
  compareIdSets(sourceIds, searchIds, "cases-search.json");

  if (!home || typeof home !== "object") {
    throw new Error("[data-consistency] cases-home.json must be an object");
  }
  if (home.totalCount !== sourceIds.size) {
    throw new Error(
      `[data-consistency] cases-home.json totalCount=${home.totalCount} but cases.json has ${sourceIds.size}`,
    );
  }

  for (const field of ["hero", "strip", "featured", "initial"]) {
    const records = home[field];
    if (!Array.isArray(records)) {
      throw new Error(`[data-consistency] cases-home.json ${field} must be an array`);
    }
    for (const [index, record] of records.entries()) {
      const id = idOf(record);
      if (!sourceIds.has(id)) {
        throw new Error(
          `[data-consistency] cases-home.json ${field}[${index}] references unknown id ${id || "<empty>"}`,
        );
      }
    }
  }

  if (!Array.isArray(categoryShards) || categoryShards.length === 0) {
    throw new Error("[data-consistency] no category shards were found");
  }

  const categoryIds = new Set();
  for (const shard of categoryShards) {
    if (!Array.isArray(shard.records)) {
      throw new Error(`[data-consistency] ${shard.name} must be an array`);
    }
    const seenInShard = new Set();
    for (const [index, record] of shard.records.entries()) {
      const id = idOf(record);
      if (!id) {
        throw new Error(`[data-consistency] ${shard.name}[${index}] is missing an id`);
      }
      if (seenInShard.has(id)) {
        throw new Error(`[data-consistency] ${shard.name} contains duplicate id ${id}`);
      }
      if (!sourceIds.has(id)) {
        throw new Error(`[data-consistency] ${shard.name} references unknown id ${id}`);
      }
      seenInShard.add(id);
      categoryIds.add(id);
    }
  }
  compareIdSets(sourceIds, categoryIds, "category shard union");

  if (browseManifest || browsePages) {
    if (!browseManifest || !Array.isArray(browsePages)) {
      throw new Error("[data-consistency] ordered browse data is incomplete");
    }
    const flattened = browsePages.flatMap((page) => page.records);
    const expected = sourceCases.slice(home.initial.length).map(idOf);
    const actual = flattened.map(idOf);
    if (browseManifest.pageCount !== browsePages.length) {
      throw new Error(
        `[data-consistency] browse manifest pageCount=${browseManifest.pageCount} but found ${browsePages.length} pages`,
      );
    }
    if (browseManifest.totalCount !== sourceIds.size) {
      throw new Error(
        `[data-consistency] browse manifest totalCount=${browseManifest.totalCount} but cases.json has ${sourceIds.size}`,
      );
    }
    if (expected.length !== actual.length || expected.some((id, index) => id !== actual[index])) {
      throw new Error("[data-consistency] ordered browse pages differ from canonical case order");
    }
  }

  return {
    caseCount: sourceIds.size,
    categoryShardCount: categoryShards.length,
  };
}

export function readGeneratedData(dataDir) {
  const categoryFiles = readdirSync(dataDir)
    .filter(
      (name) =>
        /^cases-.+\.json$/.test(name) &&
        !RESERVED_CASE_FILES.has(name),
    )
    .sort();

  const browseDir = resolve(dataDir, "browse");
  const browseManifestPath = resolve(browseDir, "manifest.json");
  const browsePageFiles = existsSync(browseDir)
    ? readdirSync(browseDir).filter((name) => /^page-\d+\.json$/.test(name)).sort()
    : [];

  return {
    sourceCases: readJson(resolve(dataDir, "cases.json")),
    home: readJson(resolve(dataDir, "cases-home.json")),
    index: readJson(resolve(dataDir, "cases-index.json")),
    search: readJson(resolve(dataDir, "cases-search.json")),
    categoryShards: categoryFiles.map((name) => ({
      name,
      records: readJson(resolve(dataDir, name)),
    })),
    browseManifest: existsSync(browseManifestPath) ? readJson(browseManifestPath) : undefined,
    browsePages: browsePageFiles.map((name) => ({
      name,
      records: readJson(resolve(browseDir, name)),
    })),
  };
}

export function validateGeneratedDataDirectory(dataDir) {
  return validateGeneratedData(readGeneratedData(dataDir));
}

export function isCategoryShardFilename(name) {
  return /^cases-.+\.json$/.test(name) && !RESERVED_CASE_FILES.has(name);
}

// ── 4K lab registry validation ──────────────────────────────────────────

const LAB_COS_KEY_RE = /^lab\/\d{4}\/\d{2}\/[^/]+\.png$/;
const LAB_SLUG_RE = /^\d{8}-.+$/;

/**
 * Schema gate for data/manual/lab.json (the 4K 实验室 source registry).
 * Catches hand edits and importer regressions before they ship: uniqueness,
 * required strings, positive dims, cosKey/slug formats, parseable dates.
 */
export function validateLabData(items) {
  if (!Array.isArray(items)) {
    throw new Error("[data-consistency] lab.json must be an array");
  }
  const ids = new Set();
  const slugs = new Set();
  for (const [index, item] of items.entries()) {
    const where = `[data-consistency] lab[${index}] (id=${item?.id ?? "?"})`;
    if (!item || typeof item !== "object") {
      throw new Error(`${where} is not an object`);
    }
    for (const field of ["id", "slug", "title", "createdAt", "prompt", "cosKey"]) {
      if (typeof item[field] !== "string" || item[field].length === 0) {
        throw new Error(`${where} missing required string field "${field}"`);
      }
    }
    if (!LAB_SLUG_RE.test(item.slug)) {
      throw new Error(`${where} slug "${item.slug}" must match ${LAB_SLUG_RE}`);
    }
    if (!LAB_COS_KEY_RE.test(item.cosKey)) {
      throw new Error(`${where} cosKey "${item.cosKey}" must match ${LAB_COS_KEY_RE}`);
    }
    for (const dim of ["width", "height"]) {
      if (!Number.isInteger(item[dim]) || item[dim] <= 0) {
        throw new Error(`${where} ${dim} must be a positive integer`);
      }
    }
    if (Number.isNaN(Date.parse(item.createdAt))) {
      throw new Error(`${where} createdAt is not a parseable date`);
    }
    if (ids.has(item.id)) throw new Error(`${where} duplicate id ${item.id}`);
    if (slugs.has(item.slug)) throw new Error(`${where} duplicate slug ${item.slug}`);
    ids.add(item.id);
    slugs.add(item.slug);
  }
  return { count: items.length };
}

/**
 * Cross-check the GENERATED lab artifacts against the source registry:
 * home.totalCount == visible(source), index rows == visible(source) by slug.
 */
export function validateGeneratedLabData({ source, home, index }) {
  const visible = source.filter((i) => !i.hidden);
  if (home.totalCount !== visible.length) {
    throw new Error(
      `[data-consistency] lab-home totalCount ${home.totalCount} != visible lab.json entries ${visible.length}`,
    );
  }
  if (!Array.isArray(index) || index.length !== visible.length) {
    throw new Error(
      `[data-consistency] lab-index has ${Array.isArray(index) ? index.length : "non-array"} rows, expected ${visible.length}`,
    );
  }
  const bySlug = new Set(visible.map((i) => i.slug));
  for (const [i, row] of index.entries()) {
    if (!bySlug.has(row.slug)) {
      throw new Error(`[data-consistency] lab-index[${i}] slug "${row.slug}" not visible in lab.json`);
    }
  }
  return { count: visible.length };
}
