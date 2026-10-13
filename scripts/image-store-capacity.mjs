/**
 * Capacity planner for the B2 image store (pure functions, no I/O).
 *
 * Why this exists (2026-10-11..13 freeze): the store bucket holds ~10GB of
 * paid-nothing B2 free tier. Daily upstream intake (~50 cases × ~0.55MB)
 * silently ate the remaining headroom, bake uploads started failing with
 * "storage cap exceeded", those cases kept their external YouMind URLs, the
 * strict hot-link gate (image-store-gate.test.mjs) rightly failed, and the
 * whole daily sync froze — no data commits for days. Capacity management
 * until then was a manual "run trim/purge when nearing the line" chore.
 *
 * The contract now: the bake self-manages the bucket. Highest WebP rung
 * (1280) is a renewable eviction pool — api/img-case.js already serves the
 * 960 bytes for missing 1280 rungs, so eviction is invisible to browsers.
 * When evicting still cannot admit a new record, the record is DEFERRED
 * (held out of published data) instead of published with a hot-linked URL —
 * the pipeline stays green and the site keeps updating.
 *
 * B2's free cap is 10 GB DECIMAL (9.42GiB already exceeded it once —
 * 2026-09-30), and the server-side cap counter lags real deletes by minutes,
 * so the plan keeps a safety margin under the hard cap.
 */

/** B2 free tier hard cap, decimal bytes (their dashboard counts decimal). */
export const B2_FREE_TIER_BYTES = 10 * 1_000_000_000;

/** Headroom for cap-counter lag + in-flight PUTs + manifest/bucket drift. */
export const CAP_SAFETY_MARGIN_BYTES = 350 * 1_000_000;

/**
 * WebP rungs the evictor may recycle, highest first. Only 1280 today:
 * api/img-case.js has an explicit -1280.webp → -960.webp byte fallback
 * (shipped 2026-09-30 with trim-duplicate-1280.mjs), so eviction cannot 404.
 * Lower rungs are load-bearing for real viewports and must never be evicted.
 */
export const EVICTABLE_WIDTHS = [1280];

/** Effective upload budget: hard cap minus safety margin. */
export function storeBudgetBytes(
  capBytes = B2_FREE_TIER_BYTES,
  marginBytes = CAP_SAFETY_MARGIN_BYTES,
) {
  return capBytes - marginBytes;
}

/**
 * Total bucket bytes implied by the manifest (current versions only).
 * Verified 2026-10-13 to match the bucket exactly (9.32GiB both sides).
 */
export function manifestBytes(entries) {
  let total = 0;
  for (const entry of Object.values(entries || {})) {
    if (!entry || entry.deferred) continue;
    total += entry.jpgBytes || 0;
    for (const bytes of Object.values(entry.webpBytes || {})) {
      total += bytes || 0;
    }
  }
  return total;
}

/**
 * Eviction candidates ordered oldest-first (oldest bakedAt = least likely
 * to still be actively browsed; newest cases keep full ladder quality).
 * Only entries that actually carry the rung qualify — byte-identical
 * duplicate 1280s were never stored (build-images skips them).
 */
export function evictionCandidates(entries, width = EVICTABLE_WIDTHS[0]) {
  const candidates = [];
  for (const [base, entry] of Object.entries(entries || {})) {
    const bytes = entry && !entry.deferred && entry.webpBytes?.[width];
    if (!bytes) continue;
    candidates.push({ base, width, bytes, bakedAt: entry.bakedAt || "" });
  }
  candidates.sort((a, b) => a.bakedAt.localeCompare(b.bakedAt));
  return candidates;
}

/**
 * Pick evictions freeing at least `needBytes`. Pure: returns the plan and
 * the pool state without mutating anything.
 */
export function planEviction(entries, needBytes, width = EVICTABLE_WIDTHS[0]) {
  const plan = [];
  let freed = 0;
  if (needBytes > 0) {
    for (const candidate of evictionCandidates(entries, width)) {
      plan.push(candidate);
      freed += candidate.bytes;
      if (freed >= needBytes) break;
    }
  }
  return { plan, freed, exhausted: freed < needBytes };
}

/** Remove one rung from a manifest entry (mutates the entry in place). */
export function applyEvictionToEntry(entry, width) {
  if (!entry) return entry;
  entry.widths = (entry.widths || []).filter((w) => w !== width);
  if (entry.webpBytes) delete entry.webpBytes[width];
  return entry;
}

/** Number of rungs left in the eviction pool + their total bytes. */
export function evictionPoolStatus(entries, width = EVICTABLE_WIDTHS[0]) {
  let rungs = 0;
  let bytes = 0;
  for (const entry of Object.values(entries || {})) {
    if (!entry || entry.deferred) continue;
    const rungBytes = entry.webpBytes?.[width];
    if (rungBytes) {
      rungs += 1;
      bytes += rungBytes;
    }
  }
  return { rungs, bytes };
}
