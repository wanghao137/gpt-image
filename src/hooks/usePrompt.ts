import { useEffect, useState } from "react";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import {
  readPromptBundleResponse,
  type PromptBundle,
} from "./prompt-response-core.mjs";

const cache = new Map<string, PromptBundle>();
const inflight = new Map<string, Promise<PromptBundle>>();

async function loadBundle(id: string): Promise<PromptBundle> {
  if (cache.has(id)) return cache.get(id) as PromptBundle;
  if (inflight.has(id)) return inflight.get(id) as Promise<PromptBundle>;

  const url = `${import.meta.env.BASE_URL}data/prompts/${id}.json`;
  const promise = fetchWithTimeout(url, { cache: "force-cache", timeoutMs: 10000 })
    .then((r) => readPromptBundleResponse(r, url))
    .then((bundle) => {
      cache.set(id, bundle);
      inflight.delete(id);
      return bundle;
    })
    .catch((err) => {
      inflight.delete(id);
      throw err;
    });

  inflight.set(id, promise);
  return promise;
}

/**
 * Load a prompt on demand, returning the cached value when available.
 * Shared by `usePrompt` and imperative callers (e.g. CaseCard copy) so the
 * timeout + de-dup + cache logic lives in one place. Throws on failure.
 */
export function loadPrompt(id: string): Promise<string> {
  return loadBundle(id).then((bundle) => bundle.prompt);
}

/** Warm the cache without subscribing to state. */
export function prefetchPrompt(id: string): void {
  if (!id || cache.has(id) || inflight.has(id)) return;
  void loadBundle(id).catch(() => {
    /* swallowed — error is surfaced when usePrompt is mounted */
  });
}

/** Get the cached prompt synchronously, or undefined. */
export function getCachedPrompt(id: string): string | undefined {
  return cache.get(id)?.prompt;
}

export interface UsePromptResult {
  prompt: string;
  promptEn: string;
  promptZh: string;
  loading: boolean;
  error: string;
}

export function usePrompt(id: string | null | undefined): UsePromptResult {
  const initial = id ? cache.get(id) : undefined;
  const [bundle, setBundle] = useState<PromptBundle>(
    initial ?? { prompt: "", promptEn: "", promptZh: "" },
  );
  const [loading, setLoading] = useState(!!id && !initial);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setBundle({ prompt: "", promptEn: "", promptZh: "" });
      setLoading(false);
      setError("");
      return;
    }

    const cached = cache.get(id);
    if (cached !== undefined) {
      setBundle(cached);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    loadBundle(id)
      .then((nextBundle) => {
        if (cancelled) return;
        setBundle(nextBundle);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载失败");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { ...bundle, loading, error };
}
