/**
 * Lab archive parsing + merge core for the 4K 实验室 section.
 *
 * Pure functions only — no fs, no network — so the importer's risky logic
 * (naming-convention filtering, sticker exclusion, id/slug/cosKey derivation,
 * hidden-flag-preserving merges) is fully unit-testable. scripts/import-lab.mjs
 * owns all I/O on top of these.
 *
 * Archive layout (F:\gpt生图, one folder per generation):
 *   YYYY-MM-DD_HH-MM-SS_WxH_<prompt snippet>/
 *     image-N.png + metadata.json + prompt.txt
 * metadata.json carries taskId / createdAt / full prompt / params /
 * actualSize / api.model / images[]. See specs/2026-08-28-lab-4k-gallery-design.md.
 */

/** Only archive-root folders matching the generation naming convention; never
 *  recurse — the archive root also holds ~200GB of collection working dirs
 *  (meigen/, YouMind/, batches/, jobs/) that must never be scanned or uploaded. */
export const LAB_FOLDER_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_/;

/** taskId + image index → stable id + SEO-friendly slug (date-prefixed). */
export function buildSlugId(taskId, imageIndex, createdAtISO) {
  const d = new Date(createdAtISO);
  const ymd =
    `${d.getUTCFullYear()}` +
    `${String(d.getUTCMonth() + 1).padStart(2, "0")}` +
    `${String(d.getUTCDate()).padStart(2, "0")}`;
  const id = imageIndex > 1 ? `${taskId}-${imageIndex}` : taskId;
  return { id, slug: `${ymd}-${id}` };
}

export function buildCosKey(id, createdAtISO) {
  const d = new Date(createdAtISO);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `lab/${d.getUTCFullYear()}/${mm}/${id}.png`;
}

/**
 * Card/detail title. Deterministic heuristic over the prompt structure:
 *   1. value of a `主題：`/`主题：` line (the generation templates' subject line)
 *   2. first non-header line (skips 提示词：/【…】 headers)
 *   3. date fallback
 * Stored at import time; manual edits in lab.json survive re-imports.
 */
/** Prompt-shaped titles that carry no visual meaning — fall back to the date
 *  form instead. Covers param-JSON prompts ("{ …") and reference-image
 *  regenerations whose entire prompt is literally 生成同款图. */
const MEANINGLESS_TITLE_RE = /^(?:[{（(【\["']|生成同款图|同款图)/;

export function deriveTitle(prompt, createdAtISO) {
  const text = String(prompt || "").trim();
  let raw = "";
  const m = text.match(/^(?:主題|主题)\s*[：:]\s*(.+)/m);
  if (m) {
    raw = m[1];
  } else {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !/^(?:提示词|プロンプト|prompt)\s*[：:]?$/i.test(l) &&
          !/^【.+】\s*[：:]?$/.test(l),
      );
    raw = lines[0] || "";
  }
  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, 40);
  // 2 CJK chars carry enough meaning to be a title (红墙); ASCII needs 3+.
  const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff]/.test(cleaned);
  const tooShort = hasCJK ? cleaned.length < 2 : cleaned.length < 3;
  if (!cleaned || MEANINGLESS_TITLE_RE.test(raw.trim()) || tooShort) {
    return `4K 生成 · ${String(createdAtISO || "").slice(0, 10)}`;
  }
  return cleaned;
}

export function derivePromptPreview(prompt, len = 120) {
  const flat = String(prompt || "").replace(/\s+/g, " ").trim();
  return flat.length > len ? flat.slice(0, len) + "…" : flat;
}

/**
 * folderName + parsed metadata.json → candidate entries (one per image).
 * `.skip` carries the reason when a folder must not be imported:
 *   - "name":        not a generation folder (collection dir etc.)
 *   - "transparent": sticker lane (params.transparent_output === true) —
 *                    user-confirmed exclusion, never uploaded or registered
 */
export function parseArchiveFolder(folderName, meta) {
  if (!LAB_FOLDER_RE.test(folderName)) return { skip: "name", entries: [] };
  if (meta?.params?.transparent_output === true) return { skip: "transparent", entries: [] };
  const images =
    Array.isArray(meta?.images) && meta.images.length > 0
      ? meta.images
      : [{ file: "image-1.png" }];
  const entries = images.map((img, i) => {
    const { id, slug } = buildSlugId(meta.taskId, i + 1, meta.createdAt);
    return {
      id,
      slug,
      title: deriveTitle(meta.prompt, meta.createdAt),
      createdAt: meta.createdAt,
      prompt: meta.prompt,
      promptPreview: derivePromptPreview(meta.prompt),
      cosKey: buildCosKey(id, meta.createdAt),
      width: meta.actualSize?.width ?? img.width ?? 0,
      height: meta.actualSize?.height ?? img.height ?? 0,
      model: meta.api?.model ?? "gpt-image-2",
      quality: meta.params?.quality,
    };
  });
  return { entries };
}

/**
 * Merge imported entries into the existing registry. Existing entries win
 * VERBATIM — re-imports must never clobber `hidden` flags or manual title
 * edits. Result is sorted by createdAt ascending for clean git diffs.
 */
export function mergeLabEntries(existing, incoming) {
  const byId = new Map();
  for (const e of existing) byId.set(e.id, e);
  for (const e of incoming) if (!byId.has(e.id)) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt)),
  );
}
