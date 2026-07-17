import type { PromptCase } from "../types";

type SortableCase = Pick<PromptCase, "id" | "createdAt">;

function numericId(value: string): number | null {
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function createdTime(value: string): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/**
 * Keep client-rendered case lists aligned with the generated-data ordering:
 * newest content first, then numeric id descending for same-sync cohorts.
 */
export function sortCasesForDisplay<T extends SortableCase>(cases: readonly T[]): T[] {
  return cases
    .map((item, index) => ({
      item,
      index,
      time: createdTime(item.createdAt),
      id: numericId(item.id),
    }))
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
