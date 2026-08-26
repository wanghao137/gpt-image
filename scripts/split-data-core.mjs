/**
 * Pure helpers extracted from split-data.mjs so they are unit-testable.
 * split-data.mjs remains the CLI entry that reads/writes public/data.
 */

function countTokens(cases, key) {
  const counts = new Map();
  for (const c of cases) {
    const seen = new Set();
    for (const token of c[key] ?? []) {
      if (!token || seen.has(token)) continue;
      seen.add(token);
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return counts;
}

const zhCompare = (a, b) => a.localeCompare(b, "zh-Hans-CN");

function toSortedList(counts) {
  return Array.from(counts.keys()).sort((a, b) => {
    const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    return diff !== 0 ? diff : zhCompare(a, b);
  });
}

function countsRecord(counts) {
  return Object.fromEntries(counts);
}

/**
 * Aggregated filter options + per-token case counts. Arrays arrive
 * pre-sorted by usage (count desc) so the UI never re-sorts; counts power
 * the chip badges in FilterBar.
 */
export function buildFilterOptions(cases) {
  const styleCounts = countTokens(cases, "styles");
  const sceneCounts = countTokens(cases, "scenes");
  const platformCounts = countTokens(cases, "platforms");
  return {
    styles: toSortedList(styleCounts),
    scenes: toSortedList(sceneCounts),
    platforms: toSortedList(platformCounts),
    styleCounts: countsRecord(styleCounts),
    sceneCounts: countsRecord(sceneCounts),
    platformCounts: countsRecord(platformCounts),
  };
}

/**
 * Count cases whose PRIMARY userCategory or any SECONDARY userCategories
 * entry equals key. This intentionally matches the runtime filter semantics
 * in case-search-core.filterCaseSearchEntries (uc + ucs), so the homepage
 * tile count always equals what the gallery filter reports.
 */
export function countCategoryCases(cases, key) {
  return cases.filter(
    (c) => c.userCategory === key || (Array.isArray(c.userCategories) && c.userCategories.includes(key)),
  ).length;
}
