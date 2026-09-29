export function imageRewriteKey(rec) {
  const targetKind = rec?.targetKind || rec?.kind || "";
  return `${targetKind}:${String(rec?.id ?? "")}:${String(rec?.url ?? "")}`;
}

export function shouldProcessExistingVariants({ force, allVariantsExist, rec }) {
  if (force) return true;
  if (!allVariantsExist) return true;

  const targetKind = rec?.targetKind || rec?.kind;
  const numericId = Number(rec?.id);

  // Manual cases are edited through the admin and can reuse the same high ID
  // with a different image. Re-encode them even if old files with that base
  // name already exist.
  if (targetKind === "case" && Number.isFinite(numericId) && numericId >= 100000) {
    return true;
  }

  // Derived template IDs are stable while their selected cover case can change.
  // Existing template*.jpg files may therefore be stale.
  if (targetKind === "template") return true;

  return false;
}

export function isRetriableImageFetchFailure(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/^HTTP (408|425|429|5\d\d)\b/.test(message)) return true;
  return /(fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR|abort|timed?\s*out|The operation was aborted)/i.test(
    message,
  );
}

export function applyImageRewrites({ cases, templates, results }) {
  const localByRecord = new Map();

  for (const result of results) {
    if (!result?.rec) continue;
    const key = imageRewriteKey(result.rec);
    const localPath = result.ok ? result.canonicalPath : result.fallbackPath;
    if (localPath) localByRecord.set(key, localPath);
  }

  let casesRewrites = 0;
  for (const c of cases) {
    const local = localByRecord.get(
      imageRewriteKey({ targetKind: "case", id: c.id, url: c.imageUrl }),
    );
    if (local && c.imageUrl !== local) {
      c.imageUrl = local;
      casesRewrites += 1;
    }
  }

  let templatesRewrites = 0;
  for (const t of templates) {
    const local = localByRecord.get(
      imageRewriteKey({ targetKind: "template", id: t.id, url: t.cover }),
    );
    if (local && t.cover !== local) {
      t.cover = local;
      templatesRewrites += 1;
    }
  }

  return { casesRewrites, templatesRewrites };
}

// ───────────────────────── store mode (B2-backed case variants, 2026-09) ──

/** Canonical base for a case stored in the image store: /images/cases/<base>.jpg */
export function storeBaseForCase(id) {
  return `case${id}`;
}

/** Same-origin public path for a store-baked case. */
export function storeLocalUrlFor(base) {
  return `/images/cases/${base}.jpg`;
}

/** All store keys for one case: canonical JPEG + full WebP ladder. */
export function storeKeysFor(base, widths) {
  return {
    jpg: `cases/${base}.jpg`,
    webp: widths.map((w) => `cases/${base}-${w}.webp`),
  };
}

/**
 * Source resolution order for one external case URL in store mode:
 *   1. X original upload (when the YouMind filename embeds a media key) —
 *      1.2–3.4× more pixels than YouMind's 1200px re-encode;
 *   2. the YouMind copy itself (never worse than the pre-fix baseline);
 * Callers append their existing-local-canonical fallback on top.
 * Pure — the fetch attempt itself lives in build-images.mjs.
 */
export function bakeSourceCandidates(imageUrl, xOriginalUrl) {
  const candidates = [];
  const xOrig = xOriginalUrl ? xOriginalUrl(imageUrl) : null;
  if (xOrig) candidates.push({ url: xOrig, kind: "x-orig" });
  candidates.push({ url: imageUrl, kind: "origin" });
  return candidates;
}

/**
 * Merge one baked record into the store manifest. Manifest shape (v1):
 *   { version, updatedAt, entries: { [base]: { widths: number[], jpgBytes,
 *     webpBytes: { [w]: number }, source: "x-orig"|"origin", bakedAt } } }
 * Pure — returns a new manifest object.
 */
export function manifestUpsert(manifest, base, record) {
  const entries = { ...(manifest.entries || {}) };
  entries[base] = {
    widths: [...record.widths].sort((a, b) => a - b),
    jpgBytes: record.jpgBytes,
    webpBytes: record.webpBytes,
    source: record.source,
    bakedAt: record.bakedAt,
  };
  return { ...manifest, version: manifest.version || 1, entries };
}

/**
 * Localisation coverage over a records array: share of records whose imageUrl
 * is already same-origin (/images/ or /uploads/). Drives the CI gate —
 * a bake run that leaves too many externals behind must not be committed.
 */
export function localisedShare(records) {
  if (!records.length) return 1;
  const local = records.filter(
    (r) => typeof r.imageUrl === "string" && /^\/(images|uploads)\//.test(r.imageUrl),
  ).length;
  return local / records.length;
}
