import { useEffect, useState } from "react";
import type { LabItem, LabUrls } from "../types";
import { getLabItemBySlug, getLabNeighbors, getLabUrls, loadLabItemBySlug } from "../lib/data-lab";
import {
  LAB_HYDRATION_ELEMENT_ID,
  parseLabHydrationData,
} from "./lab-hydration-core.mjs";

interface LabNeighbor {
  slug: string;
  t: string;
}

interface LabDetailState {
  item: LabItem;
  /** Present in every current producer; optional only for legacy blobs. */
  urls?: LabUrls;
  prev: LabNeighbor | null;
  next: LabNeighbor | null;
}

function readHydratedLab(slug: string): LabDetailState | undefined {
  if (typeof document === "undefined") return undefined;
  const text = document.getElementById(LAB_HYDRATION_ELEMENT_ID)?.textContent;
  return parseLabHydrationData(text, slug);
}

/**
 * Resolve one lab entry by slug for /lab/:slug.
 *
 * SSG: synchronous registry lookup (+ SSG neighbours).
 * Client hydration: reads the JSON blob embedded in the SSG'd HTML so the
 * first client render matches the server markup exactly (no hydration
 * bailout — same rationale as useCaseDetail).
 * SPA navigation: fetches lab/prompts/<slug>.json (warmed by preloadFetch).
 */
export function useLabDetail(slug: string | undefined): {
  item: LabItem | undefined;
  urls: LabUrls | undefined;
  prev: LabNeighbor | null;
  next: LabNeighbor | null;
  loading: boolean;
} {
  const isSSR = import.meta.env.SSR;

  const initial = (() => {
    if (!slug) return undefined;
    if (isSSR) {
      const item = getLabItemBySlug(slug);
      if (!item) return undefined;
      const neighbors = getLabNeighbors(slug);
      return {
        item,
        urls: getLabUrls(slug),
        prev: neighbors.prev ? { slug: neighbors.prev.slug, t: neighbors.prev.title } : null,
        next: neighbors.next ? { slug: neighbors.next.slug, t: neighbors.next.title } : null,
      };
    }
    return readHydratedLab(slug);
  })();

  const [state, setState] = useState(initial);
  const [resolvedFor, setResolvedFor] = useState<string | undefined>(initial?.item.slug);
  const loading = !isSSR && !initial;

  useEffect(() => {
    if (!slug) {
      setState(undefined);
      setResolvedFor(undefined);
      return;
    }
    // Already have it — SSR registry, hydration blob, or same-slug re-run.
    if (getLabItemBySlug(slug) || readHydratedLab(slug)) return;

    let cancelled = false;
    loadLabItemBySlug(slug).then((entry) => {
      if (cancelled) return;
      setResolvedFor(slug);
      setState(
        entry
          ? {
              item: {
                id: entry.id,
                slug: entry.slug,
                title: entry.title,
                createdAt: entry.createdAt,
                prompt: entry.prompt,
                promptPreview: entry.promptPreview,
                cosKey: entry.cosKey,
                width: entry.width,
                height: entry.height,
                model: entry.model,
                quality: entry.quality,
              },
              urls: {
                thumb: "",
                detail: entry.detail,
                lightbox: entry.lightbox,
                og: entry.detail,
                orig: entry.orig,
              },
              prev: entry.prev,
              next: entry.next,
            }
          : undefined,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Stale-window guard (memory: case→case bounce P0): while a lab→lab SPA
  // navigation resolves we still hold the PREVIOUS item — surface it as
  // loading so callers never treat the stale item as resolved for this URL.
  const stale = state !== undefined && resolvedFor !== undefined && resolvedFor !== slug;

  return {
    item: state?.item,
    urls: state?.urls,
    prev: state?.prev ?? null,
    next: state?.next ?? null,
    loading: loading || stale,
  };
}
