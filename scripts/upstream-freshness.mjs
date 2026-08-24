import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function countRecentUpstreamCases(rows, nowMs = Date.now(), days = 7) {
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const rowItem of Array.isArray(rows) ? rows : []) {
    if (!(Number(rowItem?.id) < 100000)) continue;
    const t = Date.parse(String(rowItem?.createdAt ?? ""));
    if (Number.isFinite(t) && t >= cutoff) count += 1;
  }
  return count;
}

function main() {
  const root = resolve(fileURLToPath(import.meta.url), "../..");
  const rows = JSON.parse(readFileSync(resolve(root, "public/data/cases.json"), "utf8"));
  for (const days of [3, 7]) {
    console.log(`upstream_new_${days}d=${countRecentUpstreamCases(rows, Date.now(), days)}`);
  }
}

const invokedDirectly = (() => {
  try {
    return realpathSync(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();
if (invokedDirectly) main();
