function numericId(value) {
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function sortedTimestampMap(timestamps) {
  return Object.fromEntries(
    Object.entries(timestamps).sort(([a], [b]) => {
      const aId = numericId(a);
      const bId = numericId(b);
      if (aId !== null && bId !== null && aId !== bId) return bId - aId;
      return a.localeCompare(b);
    }),
  );
}

function pathContentDate(item) {
  const candidates = [item?.imageUrl, item?.image, item?.cover].filter(Boolean);
  for (const candidate of candidates) {
    const match = String(candidate).match(/(?:^|\/)(20\d{2}-\d{2}-\d{2})(?:[-_/]|$)/);
    if (match) return new Date(`${match[1]}T00:00:00.000Z`).toISOString();
  }
  return undefined;
}

export function normalizedIsoDate(value) {
  if (!value) return undefined;
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

export function inferContentDate(item) {
  return normalizedIsoDate(item?.createdAt) || pathContentDate(item);
}

export function sortCasesForDisplay(cases) {
  return cases
    .map((item, index) => {
      const iso = inferContentDate(item);
      const time = iso ? Date.parse(iso) : null;
      return {
        item,
        index,
        time: Number.isFinite(time) ? time : null,
        id: numericId(item?.id),
      };
    })
    .sort((a, b) => {
      const aHasTime = a.time !== null;
      const bHasTime = b.time !== null;
      if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
      if (a.time !== null && b.time !== null && a.time !== b.time) {
        return b.time - a.time;
      }
      if (a.id !== null && b.id !== null && a.id !== b.id) return b.id - a.id;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export function applyUpstreamCaseTimestamps(upstreamCases, existingTimestamps = {}, options = {}) {
  const now = normalizedIsoDate(options.now) || new Date().toISOString();
  const stampMissing = options.stampMissing !== false;
  const previous =
    existingTimestamps && typeof existingTimestamps === "object" && !Array.isArray(existingTimestamps)
      ? existingTimestamps
      : {};
  const timestamps = {};

  const cases = upstreamCases.map((item) => {
    const id = String(item?.id ?? "").trim();
    const explicit = inferContentDate(item);
    const known = normalizedIsoDate(previous[id]);
    const createdAt = explicit || known || (stampMissing ? now : undefined);
    if (id && createdAt) timestamps[id] = createdAt;
    return createdAt ? { ...item, createdAt } : { ...item };
  });

  return {
    cases,
    timestamps: sortedTimestampMap(timestamps),
  };
}
