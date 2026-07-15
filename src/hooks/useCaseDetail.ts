import { useEffect, useState } from "react";
import type { PromptCase } from "../types";
import { getCaseBySlug, loadCaseIndex, loadShard, getCachedShard } from "../lib/data";
import {
  findCaseIndexEntry,
  findCaseInShard,
} from "./case-detail-resolution-core.mjs";
import {
  CASE_HYDRATION_ELEMENT_ID,
  parseCaseHydrationData,
} from "./case-hydration-core.mjs";

function readHydratedCase(slug: string): PromptCase | undefined {
  if (typeof document === "undefined") return undefined;
  const text = document.getElementById(CASE_HYDRATION_ELEMENT_ID)?.textContent;
  return parseCaseHydrationData(text, slug)?.caseData;
}

/**
 * Resolve a single case by slug for the detail page.
 *
 * SSG: getCaseBySlug works (ALL_CASES is populated on the server).
 * Client: getCaseBySlug returns undefined (ALL_CASES is empty). This hook
 * fetches cases-index.json to find the slug's category, then loads the
 * category shard to get the full case object.
 *
 * Returns undefined while loading on the client. The SSG'd HTML stays
 * visible during this brief window — React hydration attaches event
 * listeners to the existing DOM, and once the case resolves, the component
 * re-renders with interactive state (favorites, copy, etc.).
 */
export function useCaseDetail(slug: string | undefined): {
  caseData: PromptCase | undefined;
  loading: boolean;
} {
  // SSR or SSG hydration: use synchronous lookup.
  const isSSR = import.meta.env.SSR;
  const ssgCase = slug ? getCaseBySlug(slug) ?? readHydratedCase(slug) : undefined;

  const [caseData, setCaseData] = useState<PromptCase | undefined>(ssgCase);
  const [loading, setLoading] = useState(!isSSR && !ssgCase);

  useEffect(() => {
    if (!slug) {
      setCaseData(undefined);
      setLoading(false);
      return;
    }

    // If we already have it (SSR or cached shard), use it.
    const existing = getCaseBySlug(slug);
    if (existing) {
      setCaseData(existing);
      setLoading(false);
      return;
    }

    // Client: load index → find category → load shard → find case.
    let cancelled = false;
    setLoading(true);

    loadCaseIndex()
      .then((index) => {
        if (cancelled) return;
        const entry = findCaseIndexEntry(index, slug);
        if (!entry) {
          setCaseData(undefined);
          setLoading(false);
          return;
        }
        // Check if shard is already cached.
        const cached = getCachedShard(entry.uc);
        if (cached) {
          const found = findCaseInShard(cached, slug, entry.id);
          setCaseData(found);
          setLoading(false);
          return;
        }
        return loadShard(entry.uc).then((shard) => {
          if (cancelled) return;
          const found = findCaseInShard(shard, slug, entry.id);
          setCaseData(found);
          setLoading(false);
        });
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { caseData, loading };
}
