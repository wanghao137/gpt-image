import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import type { CaseSearchEntry } from "../lib/case-search-core.mjs";
import { HOME_DATA } from "./useHomeData";

export type SearchEntry = CaseSearchEntry;

export interface FilterOptions {
  styles: string[];
  scenes: string[];
  platforms: string[];
}

interface AsyncResource<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
}

let searchCache: SearchEntry[] | null = null;
let searchInflight: Promise<SearchEntry[]> | null = null;

let filterCache: FilterOptions | null = null;
let filterInflight: Promise<FilterOptions> | null = null;

/** Fetch the full-library search index only when a search/filter needs it. */
export function loadSearchIndex(): Promise<SearchEntry[]> {
  if (searchCache) return Promise.resolve(searchCache);
  if (searchInflight) return searchInflight;

  const url = `${import.meta.env.BASE_URL}data/cases-search.json?v=${HOME_DATA.revision}`;
  searchInflight = fetchWithTimeout(url, { cache: "force-cache", timeoutMs: 10000 })
    .then((response) => {
      if (!response.ok) throw new Error(`cases-search: ${response.status}`);
      return response.json();
    })
    .then((data: SearchEntry[]) => {
      searchCache = data;
      searchInflight = null;
      return data;
    })
    .catch((error) => {
      searchInflight = null;
      throw error;
    });

  return searchInflight;
}

/** Fetch the tiny filter-options payload independently from the search index. */
export function loadFilterOptions(): Promise<FilterOptions> {
  if (filterCache) return Promise.resolve(filterCache);
  if (filterInflight) return filterInflight;

  const url = `${import.meta.env.BASE_URL}data/filter-options.json?v=${HOME_DATA.revision}`;
  filterInflight = fetchWithTimeout(url, { cache: "force-cache", timeoutMs: 10000 })
    .then((response) => {
      if (!response.ok) throw new Error(`filter-options: ${response.status}`);
      return response.json();
    })
    .then((data: FilterOptions) => {
      filterCache = data;
      filterInflight = null;
      return data;
    })
    .catch((error) => {
      filterInflight = null;
      throw error;
    });

  return filterInflight;
}

export function getCachedSearchIndex(): SearchEntry[] | null {
  return searchCache;
}

export function getCachedFilterOptions(): FilterOptions | null {
  return filterCache;
}

export function useFilterOptions(): AsyncResource<FilterOptions> {
  const [data, setData] = useState<FilterOptions | null>(filterCache);
  const [loading, setLoading] = useState(!filterCache);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (filterCache) {
      setData(filterCache);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    loadFilterOptions()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason : new Error(String(reason)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, loading, error, retry };
}

export function useSearchIndex(enabled: boolean): AsyncResource<SearchEntry[]> {
  const [data, setData] = useState<SearchEntry[] | null>(searchCache);
  const [loading, setLoading] = useState(enabled && !searchCache);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setLoading(false);
      setError(null);
      return;
    }
    if (searchCache) {
      setData(searchCache);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    loadSearchIndex()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason : new Error(String(reason)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, enabled]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, loading, error, retry };
}
