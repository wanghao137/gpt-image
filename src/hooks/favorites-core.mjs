export function parseFavoriteIds(raw) {
  if (typeof raw !== "string" || raw.length === 0) return new Set();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Set();
  }

  if (!Array.isArray(parsed)) return new Set();

  const ids = [];
  for (const value of parsed) {
    if (typeof value === "string" && value.length > 0) {
      ids.push(value);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      ids.push(String(value));
    }
  }
  return new Set(ids);
}
