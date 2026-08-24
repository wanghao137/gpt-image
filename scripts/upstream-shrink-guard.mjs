/**
 * Guards against a partial upstream response silently wiping the library.
 * sync.mjs trusts any valid manifest, so a truncated category file would make
 * thousands of cases vanish AND their prompt files be deleted as "orphans".
 * The floor converts suspicious shrinkage into the same failure path as a
 * fully dead upstream: hard-fail in CI, cached-snapshot fallback under
 * --optional.
 */
export class UpstreamShrinkError extends Error {
  constructor(message) {
    super(message);
    this.name = "UpstreamShrinkError";
  }
}

export function assertUpstreamNotShrunk({ fetchedCount, cachedCount, minRatio }) {
  const ratio = minRatio == null ? 0.9 : Number(minRatio);
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
    throw new Error(`invalid minRatio: ${minRatio}`);
  }
  if (!Number.isFinite(cachedCount) || cachedCount <= 0) {
    return { ok: true, floor: 0 };
  }
  const floor = Math.floor(cachedCount * ratio);
  if (fetchedCount < floor) {
    throw new UpstreamShrinkError(
      `upstream shrank suspiciously: fetched ${fetchedCount} cases < floor ${floor} ` +
        `(${Math.round(ratio * 100)}% of cached ${cachedCount}); refusing to overwrite public/data`,
    );
  }
  return { ok: true, floor };
}
