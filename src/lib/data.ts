/**
 * Single source of truth for case + template data inside the React tree.
 *
 * On SSG (build time) we statically import the JSON so every detail/category
 * page has the data available without a fetch — that's what makes the static
 * HTML output meaningful for SEO. The same import works at runtime in the
 * browser; Vite inlines the JSON into the client bundle.
 *
 * If the dataset grows past ~1MB we'll switch to a chunked import (per
 * userCategory) — until then the simplicity is worth more than the bytes.
 */
import casesJson from "../../public/data/cases.json";
import templatesJson from "../../public/data/templates.json";
import type { PromptCase, PromptTemplate } from "../types";

export const ALL_CASES: PromptCase[] = casesJson as PromptCase[];
export const ALL_TEMPLATES: PromptTemplate[] = templatesJson as PromptTemplate[];

const BY_SLUG = new Map<string, PromptCase>(ALL_CASES.map((c) => [c.slug, c]));
const BY_ID = new Map<string, PromptCase>(ALL_CASES.map((c) => [c.id, c]));

export function getCaseBySlug(slug: string): PromptCase | undefined {
  return BY_SLUG.get(slug);
}
export function getCaseById(id: string): PromptCase | undefined {
  return BY_ID.get(id);
}

/** Cases grouped by user-intent bucket. */
export function casesByUserCategory(key: string): PromptCase[] {
  return ALL_CASES.filter((c) => c.userCategory === key);
}

/** "Related" picks: same userCategory first, then by overlapping tags. */
export function relatedCases(c: PromptCase, n = 6): PromptCase[] {
  const sameBucket = ALL_CASES.filter(
    (other) => other.id !== c.id && other.userCategory === c.userCategory,
  );
  if (sameBucket.length >= n) return sameBucket.slice(0, n);

  const tagSet = new Set([...c.tags, ...c.styles, ...c.scenes]);
  const byTag = ALL_CASES.filter(
    (other) =>
      other.id !== c.id &&
      other.userCategory !== c.userCategory &&
      [...other.tags, ...other.styles, ...other.scenes].some((t) => tagSet.has(t)),
  );
  return [...sameBucket, ...byTag].slice(0, n);
}

/** Sequential prev/next within a sorted-by-id list (for /case/:slug nav). */
export function caseNeighbors(c: PromptCase): {
  prev?: PromptCase;
  next?: PromptCase;
} {
  const i = ALL_CASES.findIndex((x) => x.id === c.id);
  if (i < 0) return {};
  return {
    prev: i + 1 < ALL_CASES.length ? ALL_CASES[i + 1] : undefined, // older
    next: i > 0 ? ALL_CASES[i - 1] : undefined, // newer
  };
}
