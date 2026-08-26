function normalized(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-CN");
}

function createdTime(value) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : 0;
}

export function templateCategories(templates) {
  const counts = new Map();
  for (const template of templates) {
    const category = String(template.category ?? "").trim();
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) =>
    a.label.localeCompare(b.label, "zh-Hans-CN"),
  );
}

export function filterAndSortTemplates(templates, options = {}) {
  const query = normalized(options.query);
  const category = String(options.category ?? "").trim();
  const sort = options.sort ?? "curated";

  const filtered = templates.filter((template) => {
    if (category && template.category !== category) return false;
    if (!query) return true;
    const haystack = normalized(
      [
        template.title,
        template.category,
        template.description,
        template.useWhen,
        ...(template.tags ?? []),
      ].join(" "),
    );
    return haystack.includes(query);
  });

  if (sort === "newest") {
    return filtered
      .map((item, index) => ({ item, index, time: createdTime(item.createdAt) }))
      .sort((a, b) => b.time - a.time || a.index - b.index)
      .map(({ item }) => item);
  }
  if (sort === "title") {
    return [...filtered].sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"));
  }
  return filtered;
}

const ARGUMENT_PATTERN =
  /\{argument\s+name=(?:"([^"]+)"|'([^']+)'|([^\s}]+))(?:\s+default=(?:"([^"]*)"|'([^']*)'|([^\s}]+)))?[^}]*\}/g;

export function extractTemplateVariables(prompt) {
  const variables = [];
  const seen = new Set();
  for (const match of String(prompt ?? "").matchAll(ARGUMENT_PATTERN)) {
    const name = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    variables.push({
      name,
      defaultValue: (match[4] ?? match[5] ?? match[6] ?? "").trim(),
    });
  }
  return variables;
}

/**
 * Substitute {argument} markers with user values (blank/missing → default).
 * Prompts without markers pass through untouched, so the copy button can
 * always call this unconditionally.
 */
export function applyTemplateVariables(prompt, values = {}) {
  return String(prompt ?? "").replace(
    ARGUMENT_PATTERN,
    (match, n1, n2, n3, d1, d2, d3) => {
      const name = (n1 ?? n2 ?? n3 ?? "").trim();
      const fallback = (d1 ?? d2 ?? d3 ?? "").trim();
      const given = String(values?.[name] ?? "").trim();
      return given || fallback || match;
    },
  );
}

export function derivedCaseSearchHref(caseId) {
  return `/cases?q=${encodeURIComponent(String(caseId))}`;
}
