import { useEffect, useState } from "react";
import type { PromptCase } from "../types";
import { loadShard, getCachedShard } from "../lib/data";

/**
 * Load the case list for a specific userCategory shard.
 *
 * In SSG mode, the page is pre-rendered with the full dataset, so the initial
 * HTML is correct. On client hydration, this hook fetches the category shard
 * to repopulate interactive state (favorites, scroll position, filtering).
 *
 * The shard is cached per-category, so navigating between categories or
 * returning from a case detail page is instant after the first load.
 */
export function useCategoryCases(categoryKey: string | undefined): {
  cases: PromptCase[];
  loading: boolean;
} {
  const [cases, setCases] = useState<PromptCase[]>(() => getCachedShard(categoryKey ?? "") ?? []);
  const [loading, setLoading] = useState(!getCachedShard(categoryKey ?? ""));

  useEffect(() => {
    if (!categoryKey) {
      setCases([]);
      setLoading(false);
      return;
    }

    const cached = getCachedShard(categoryKey);
    if (cached) {
      setCases(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    loadShard(categoryKey)
      .then((data) => {
        if (!cancelled) {
          setCases(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryKey]);

  return { cases, loading };
}
