/**
 * Tiny formatting helpers shared across cards / listings.
 *
 * No `Intl.RelativeTimeFormat` here on purpose: we want compact, ASCII-only
 * output (`3d`, `2w`) that fits in the card footer at 11–12px without
 * wrapping or competing with surrounding metadata. Browsers' relative-time
 * locale strings ("3 天前") are good for accessibility but visually noisy.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Compact relative-time string for the given ISO-8601 timestamp.
 *
 *   - <1m   → "now"
 *   - <1h   → "5m"
 *   - <1d   → "7h"
 *   - ≤30d  → "3d"
 *   - ≤6w   → "2w"
 *   - older → ISO date "2026-01-19"
 *
 * Returns `""` when `iso` is missing / unparseable so callers can render
 * a fallback without null-checking.
 */
export function relativeTimeShort(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";

  const diff = Math.max(0, now - t);
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff <= 30 * DAY) return `${Math.floor(diff / DAY)}d`;
  if (diff <= 6 * WEEK) return `${Math.floor(diff / WEEK)}w`;

  // Fall back to ISO date (yyyy-mm-dd) for anything older.
  return iso.slice(0, 10);
}

/**
 * Truncate an `@handle` / display name to fit a card footer without wrapping.
 * Keeps a leading `@` if present, trims to `max` graphemes.
 */
export function truncateHandle(s: string | undefined, max = 14): string {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
