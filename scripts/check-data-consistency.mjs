import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateGeneratedDataDirectory,
  validateGeneratedLabData,
  validateLabData,
} from "./data-consistency-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../public/data");
const summary = validateGeneratedDataDirectory(dataDir);

console.log(
  `data-consistency: ${summary.caseCount} cases across ${summary.categoryShardCount} category shards`,
);

// 4K lab registry + generated shards. Absent files are fine (fresh clone
// before first import/build) — present ones must validate.
const labJsonPath = resolve(__dirname, "../data/manual/lab.json");
if (existsSync(labJsonPath)) {
  const labItems = JSON.parse(readFileSync(labJsonPath, "utf8"));
  const labSummary = validateLabData(labItems);
  const homePath = resolve(dataDir, "lab-home.json");
  const indexPath = resolve(dataDir, "lab-index.json");
  if (existsSync(homePath) && existsSync(indexPath)) {
    const generated = validateGeneratedLabData({
      source: labItems,
      home: JSON.parse(readFileSync(homePath, "utf8")),
      index: JSON.parse(readFileSync(indexPath, "utf8")),
    });
    console.log(`data-consistency: ${generated.count}/${labSummary.count} lab entries visible in shards`);
  } else {
    console.log(`data-consistency: ${labSummary.count} lab entries (shards not generated yet)`);
  }
}
