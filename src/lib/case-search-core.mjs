function lower(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-CN");
}

function values(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function createCaseSearchEntry(item) {
  const styles = values(item.styles);
  const scenes = values(item.scenes);
  const platforms = values(item.platforms);
  const secondaryCategories = values(item.userCategories);
  const searchText = [
    item.id,
    item.title,
    item.titleEn,
    item.category,
    item.userCategory,
    ...secondaryCategories,
    item.promptPreview,
    item.source,
    ...values(item.tags),
    ...styles,
    ...scenes,
    ...platforms,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: item.id,
    t: item.title,
    c: item.category,
    uc: item.userCategory,
    ucs: secondaryCategories,
    s: styles,
    sc: scenes,
    p: platforms,
    q: lower(searchText),
  };
}

function intersects(items, active) {
  if (!active || active.size === 0) return true;
  return items.some((item) => active.has(item));
}

export function filterCaseSearchEntries(entries, filters = {}) {
  const query = lower(filters.query);
  const categories = filters.categories ?? new Set();
  const styles = filters.styles ?? new Set();
  const scenes = filters.scenes ?? new Set();
  const platforms = filters.platforms ?? new Set();
  const favoriteIds = filters.favoriteIds ?? null;

  return entries.filter((entry) => {
    if (favoriteIds && !favoriteIds.has(entry.id)) return false;
    if (categories.size > 0 && !intersects([entry.uc, ...values(entry.ucs)], categories)) {
      return false;
    }
    if (!intersects(values(entry.s), styles)) return false;
    if (!intersects(values(entry.sc), scenes)) return false;
    if (!intersects(values(entry.p), platforms)) return false;
    if (query && !lower(entry.q || [entry.id, entry.t, entry.c].join("\n")).includes(query)) {
      return false;
    }
    return true;
  });
}

export function categoriesForSearchEntries(entries) {
  const categories = new Set();
  for (const entry of entries) {
    if (entry.uc) categories.add(entry.uc);
    for (const category of values(entry.ucs)) categories.add(category);
  }
  return categories;
}
