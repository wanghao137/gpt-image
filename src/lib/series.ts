import type { PromptCase } from "../types";

/**
 * Group same-series cases so they can be collapsed into a single carousel card.
 *
 * Rules:
 *   1. Walk the input in order. Cases with the same non-empty `seriesId` form a
 *      group; the group occupies the position of its first-seen member.
 *   2. Inside each group, members are sorted by `createdAt` desc (newest first,
 *      fallback to original order when timestamps tie or are missing). The
 *      newest member becomes the group's "lead" and renders the card.
 *   3. Cases without `seriesId` pass through unchanged, in their original slot.
 *
 * The return shape keeps `leads` as a flat ordered list (so callers can slice
 * for pagination) and gives O(1) sibling lookup by lead id.
 */
export function groupSeries(cases: PromptCase[]): {
  leads: PromptCase[];
  siblingsByLeadId: Map<string, PromptCase[]>;
} {
  const siblingsByLeadId = new Map<string, PromptCase[]>();
  if (!cases.length) return { leads: [], siblingsByLeadId };

  // First pass: collect group members in encounter order, plus the index of
  // each group's first appearance so we know where to slot the lead.
  const groupOrder = new Map<string, number>(); // seriesId -> first index in `leads`
  const groupMembers = new Map<string, PromptCase[]>(); // seriesId -> members
  const leads: PromptCase[] = [];

  for (const c of cases) {
    const sid = typeof c.seriesId === "string" && c.seriesId.trim() ? c.seriesId.trim() : undefined;
    if (!sid) {
      leads.push(c);
      continue;
    }
    if (!groupMembers.has(sid)) {
      groupMembers.set(sid, []);
      groupOrder.set(sid, leads.length);
      // Reserve the lead slot — filled after sorting below.
      leads.push(c);
    }
    groupMembers.get(sid)!.push(c);
  }

  // Second pass: for each group, sort members by createdAt desc and install
  // the newest member as the lead at its reserved position.
  for (const [sid, members] of groupMembers) {
    if (members.length <= 1) {
      // Solo series member — nothing to merge, behaves like an ungrouped case.
      // The lead is already in place from the first-seen push above.
      continue;
    }
    const sorted = [...members].sort((a, b) => compareCreatedAt(b, a));
    const lead = sorted[0];
    const siblings = sorted.slice(1);
    const slotIndex = groupOrder.get(sid)!;
    leads[slotIndex] = lead;
    siblingsByLeadId.set(lead.id, siblings);
  }

  return { leads, siblingsByLeadId };
}

/** Comparator: newer createdAt first. Treats missing/empty as oldest. */
function compareCreatedAt(a: PromptCase, b: PromptCase): number {
  const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
  const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
  const taN = Number.isFinite(ta) ? ta : 0;
  const tbN = Number.isFinite(tb) ? tb : 0;
  if (taN !== tbN) return taN - tbN;
  // Stable fallback — keep original order by id (deterministic).
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Convenience: look up siblings for a lead case (empty when ungrouped). */
export function siblingsOf(
  lead: PromptCase,
  map: Map<string, PromptCase[]>,
): PromptCase[] {
  return map.get(lead.id) ?? [];
}
