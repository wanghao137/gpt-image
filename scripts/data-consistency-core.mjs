import { readFileSync, readdirSync } from "node:fs";
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

export function validateGeneratedData({ sourceCases, home, index, search, categoryShards }) {
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

  return {
    sourceCases: readJson(resolve(dataDir, "cases.json")),
    home: readJson(resolve(dataDir, "cases-home.json")),
    index: readJson(resolve(dataDir, "cases-index.json")),
    search: readJson(resolve(dataDir, "cases-search.json")),
    categoryShards: categoryFiles.map((name) => ({
      name,
      records: readJson(resolve(dataDir, name)),
    })),
  };
}

export function validateGeneratedDataDirectory(dataDir) {
  return validateGeneratedData(readGeneratedData(dataDir));
}

export function isCategoryShardFilename(name) {
  return /^cases-.+\.json$/.test(name) && !RESERVED_CASE_FILES.has(name);
}
