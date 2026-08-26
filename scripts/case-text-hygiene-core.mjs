/**
 * Text hygiene for case rows arriving from upstream (YouMind) feeds.
 *
 * WHY: 8 legacy rows (as of 2026-08-25) render literally useless H1s —
 * title "提示词：", "角色设定提示词：", "分辨率：" — plus promptPreview
 * set to the string "null" and titleEn holding clipped Chinese description
 * text. These guards run at ingest (sync.mjs normalizeCase) and via a
 * one-time backfill so both new and existing rows are clean.
 */

// Matches three junk shapes: "角色设定提示词：", bare labels ("分辨率：" /
// "标题：" / "prompt:"), and bare "提示词：". Alternation because the label
// and 提示词 are each independently optional — "分辨率：" has no 提示词.
// Case-insensitive so English label prefixes ("Character sheet prompt:",
// "Resolution:", "Prompt:", "Title:", "Description:") strip in any casing.
const TITLE_JUNK_PREFIX_RE =
  /^(?:(?:角色设定|分辨率|标题|描述|prompt)\s*提示词\s*[:：]\s*|(?:角色设定|分辨率|标题|描述|prompt|character\s+sheet\s+prompt|resolution|title|description)\s*[:：]\s*|提示词\s*[:：]\s*)/i;

export function normalizeCaseTitle(rawTitle, fallbackText = "") {
  let title = String(rawTitle ?? "").trim();
  // Upstream locale fields sometimes hold the literal string "null".
  if (title === "null" || title === "undefined") title = "";
  // Strip repeatedly: upstream sometimes stacks prefixes ("角色设定提示词：").
  while (TITLE_JUNK_PREFIX_RE.test(title)) {
    title = title.replace(TITLE_JUNK_PREFIX_RE, "").trim();
  }
  if (title) return title;
  // Derive from the first sentence of the fallback description — with the
  // same "null"-string guard, or "null" becomes a 4-char "title".
  const fb = cleanText(fallbackText) ?? "";
  const sentence = fb
    .replace(TITLE_JUNK_PREFIX_RE, "")
    .split(/[。.!?\n]/)
    .map((s) => s.trim())
    .find((s) => s.length > 0 && s !== "null" && s !== "undefined");
  if (!sentence) return "";
  return sentence.length > 40 ? `${sentence.slice(0, 39)}…` : sentence;
}

export function cleanText(value) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  if (!s || s === "null" || s === "undefined") return undefined;
  return s;
}

export function isCjkDominant(text) {
  const s = String(text ?? "");
  const cjk = (s.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latin = (s.match(/[A-Za-z]/g) ?? []).length;
  return cjk > 0 && cjk >= latin;
}

export function sanitizeTitleEn(titleEn, zhTitle) {
  const cleaned = cleanText(titleEn);
  if (cleaned === undefined) return undefined;
  if (zhTitle && cleaned === zhTitle) return undefined;
  if (isCjkDominant(cleaned)) return undefined;
  return cleaned;
}
