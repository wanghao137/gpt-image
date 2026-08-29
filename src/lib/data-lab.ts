/**
 * Lab data API — dual-mode (SSG full / Client sharded), mirroring data.ts.
 *
 *   SSG (Node build): SSG_LAB_ITEMS holds the full registry (hidden filtered)
 *     for getStaticPaths, detail rendering, and neighbor lookup.
 *   Client (browser): hydrates from inline HTML; the only network reads are
 *     lab/browse/page-NNN.json (load-more) and lab/prompts/<slug>.json (SPA
 *     detail fallback). The full registry is never in the client bundle.
 */
import type { LabHomePayload, LabItem, LabLiteRow, LabPromptEntry } from "../types";
import { fetchWithTimeout } from "./fetchWithTimeout";
import labHomeJson from "../../public/data/lab-home.json";

export const LAB_HOME = labHomeJson as LabHomePayload;
const REVISION = LAB_HOME.revision;

// ── SSG data loading ──────────────────────────────────────────────────
// Same pattern as data.ts: the dynamic import is resolved at SSR build time
// and eliminated in the client build.
let SSG_LAB_ITEMS: LabItem[] = [];

if (import.meta.env.SSR) {
  const ssg = await import("./data-lab-ssg");
  SSG_LAB_ITEMS = ssg.SSG_LAB_ITEMS;
}

/** Full visible registry — SSG only; empty array in the client. */
export function getLabItems(): LabItem[] {
  return SSG_LAB_ITEMS;
}

/** SSG slug lookup for /lab/:slug rendering. Returns undefined on client. */
export function getLabItemBySlug(slug: string): LabItem | undefined {
  return SSG_LAB_ITEMS.find((i) => i.slug === slug);
}

/**
 * Adjacent slugs in newest-first display order: `prev` is the newer neighbour
 * (one row above), `next` the older one. SSG only.
 */
export function getLabNeighbors(
  slug: string,
): { prev: LabItem | undefined; next: LabItem | undefined } {
  const items = [...SSG_LAB_ITEMS].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  );
  const idx = items.findIndex((i) => i.slug === slug);
  if (idx === -1) return { prev: undefined, next: undefined };
  return { prev: items[idx - 1], next: items[idx + 1] };
}

// ── Client shard loading ──────────────────────────────────────────────

const browsePageCache = new Map<number, LabLiteRow[]>();
const browsePageInflight = new Map<number, Promise<LabLiteRow[]>>();

/** Fetch one lab browse page (newest-first, non-overlapping). Page 0 == LAB_HOME.items. */
export function loadLabBrowsePage(page: number): Promise<LabLiteRow[]> {
  if (browsePageCache.has(page)) return Promise.resolve(browsePageCache.get(page)!);
  if (browsePageInflight.has(page)) return browsePageInflight.get(page)!;

  const filename = `page-${String(page).padStart(3, "0")}.json`;
  const url = `${import.meta.env.BASE_URL}data/lab/browse/${filename}?v=${REVISION}`;
  const promise = fetchWithTimeout(url, { cache: "force-cache", timeoutMs: 10000 })
    .then((response) => {
      if (!response.ok) throw new Error(`lab browse page ${page}: ${response.status}`);
      return response.json();
    })
    .then((data: LabLiteRow[]) => {
      browsePageCache.set(page, data);
      browsePageInflight.delete(page);
      return data;
    })
    .catch((error) => {
      browsePageInflight.delete(page);
      throw error;
    });

  browsePageInflight.set(page, promise);
  return promise;
}

/** Direct SPA fallback fetch of a lab detail item's full data. */
export async function loadLabItemBySlug(slug: string): Promise<LabPromptEntry | null> {
  const url = `${import.meta.env.BASE_URL}data/lab/prompts/${slug}.json?v=${REVISION}`;
  try {
    const response = await fetchWithTimeout(url, { cache: "force-cache", timeoutMs: 10000 });
    if (!response.ok) return null;
    return (await response.json()) as LabPromptEntry;
  } catch {
    return null;
  }
}
