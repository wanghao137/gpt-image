function caseStats(snapshot) {
  const cases = Array.isArray(snapshot?.casesPayload?.cases)
    ? snapshot.casesPayload.cases
    : [];
  const ids = cases
    .map((item) => Number(item?.id))
    .filter((id) => Number.isFinite(id));
  return {
    count: cases.length,
    maxId: ids.length > 0 ? Math.max(...ids) : -Infinity,
  };
}

export function chooseBestUpstreamSnapshot(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    throw new Error("no upstream snapshots to choose from");
  }

  return snapshots.reduce((best, current) => {
    const bestStats = caseStats(best);
    const currentStats = caseStats(current);
    if (currentStats.count !== bestStats.count) {
      return currentStats.count > bestStats.count ? current : best;
    }
    if (currentStats.maxId !== bestStats.maxId) {
      return currentStats.maxId > bestStats.maxId ? current : best;
    }
    return best;
  });
}
