/** Extract the stable numeric case id appended by migrate-v2's slug builder. */
export function caseIdFromSlug(slug) {
  if (typeof slug !== "string") return undefined;
  return slug.match(/(?:^|-)(\d+)$/)?.[1];
}

/**
 * Resolve an index entry across slug migrations and mixed CDN cache versions.
 *
 * Exact slug wins. If a title translation changed the human-readable portion
 * of the slug, the numeric id suffix remains stable and is used as a fallback.
 */
export function findCaseIndexEntry(index, slug) {
  if (!Array.isArray(index) || !slug) return undefined;
  const exact = index.find((entry) => entry?.slug === slug);
  if (exact) return exact;

  const id = caseIdFromSlug(slug);
  return id ? index.find((entry) => String(entry?.id) === id) : undefined;
}

/** Find the case in a shard using the same exact-slug-then-stable-id policy. */
export function findCaseInShard(shard, slug, fallbackId) {
  if (!Array.isArray(shard) || !slug) return undefined;
  const exact = shard.find((item) => item?.slug === slug);
  if (exact) return exact;

  const id = fallbackId || caseIdFromSlug(slug);
  return id ? shard.find((item) => String(item?.id) === String(id)) : undefined;
}
