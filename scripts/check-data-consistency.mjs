import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateGeneratedDataDirectory } from "./data-consistency-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../public/data");
const summary = validateGeneratedDataDirectory(dataDir);

console.log(
  `data-consistency: ${summary.caseCount} cases across ${summary.categoryShardCount} category shards`,
);
