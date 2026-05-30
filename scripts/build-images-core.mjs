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
  return /(fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR)/i.test(message);
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
