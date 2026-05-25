import type { PromptTemplate } from "../types";

type SortableTemplate = Pick<PromptTemplate, "sourceType" | "createdAt">;

function createdTime(value?: string): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function sortTemplatesForDisplay<T extends SortableTemplate>(templates: readonly T[]): T[] {
  return templates
    .map((item, index) => ({
      item,
      index,
      time: createdTime(item.createdAt),
    }))
    .sort((a, b) => {
      const aManual = a.item.sourceType === "manual";
      const bManual = b.item.sourceType === "manual";
      if (aManual !== bManual) return aManual ? -1 : 1;

      if (aManual && bManual) {
        const aHasDate = a.time !== null;
        const bHasDate = b.time !== null;
        if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;
        if (a.time !== null && b.time !== null && a.time !== b.time) {
          return b.time - a.time;
        }
      }

      return a.index - b.index;
    })
    .map(({ item }) => item);
}
