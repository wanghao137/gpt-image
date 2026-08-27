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
  error: string | null;
  retry: () => void;
} {
  // SSR or SSG hydration: use synchronous lookup.
  const isSSR = import.meta.env.SSR;
  const ssgCase = slug ? getCaseBySlug(slug) ?? readHydratedCase(slug) : undefined;

  const [caseData, setCaseData] = useState<PromptCase | undefined>(ssgCase);
  const [loading, setLoading] = useState(!isSSR && !ssgCase);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Which slug the current `caseData` was resolved for. Lets us tell a
  // still-resolving stale case (previous slug) apart from a resolved case
  // whose canonical slug differs from the URL (alias fixup).
  const [resolvedFor, setResolvedFor] = useState<string | undefined>(ssgCase?.slug);

  useEffect(() => {
    if (!slug) {
      setCaseData(undefined);
      setResolvedFor(undefined);
      setLoading(false);
      setError(null);
      return;
    }

    // If we already have it (SSR or cached shard), use it.
    const existing = getCaseBySlug(slug);
    if (existing) {
      setCaseData(existing);
      setResolvedFor(slug);
      setLoading(false);
      setError(null);
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
          setResolvedFor(slug);
          setLoading(false);
          setError(null);
          return;
        }
        // Check if shard is already cached.
        const cached = getCachedShard(entry.uc);
        if (cached) {
          const found = findCaseInShard(cached, slug, entry.id);
          setCaseData(found);
          setResolvedFor(slug);
          setLoading(false);
          setError(null);
          return;
        }
        return loadShard(entry.uc).then((shard) => {
          if (cancelled) return;
          const found = findCaseInShard(shard, slug, entry.id);
          setCaseData(found);
          setResolvedFor(slug);
          setLoading(false);
          setError(null);
        });
      })
      .catch((reason) => {
        if (cancelled) return;
        // Keep whatever case is on screen (continuity), but surface the
        // failure instead of silently rendering the wrong case forever.
        setLoading(false);
        setError(reason instanceof Error ? reason.message : "案例数据加载失败");
      });

    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  // While a case→case navigation resolves, `caseData` still holds the
  // PREVIOUS case. Surface that window as `loading` during render (the
  // setLoading(true) above only lands after commit) so consumers never
  // mistake the stale case for a resolved alias mismatch — the detail
  // page's canonical-slug fixup must not fire here, or it bounces the
  // URL straight back to the old case and eats the click.
  const staleWindow = caseData !== undefined && resolvedFor !== undefined && resolvedFor !== slug;

  return { caseData, loading: loading || staleWindow, error, retry: () => setAttempt((n) => n + 1) };
}
