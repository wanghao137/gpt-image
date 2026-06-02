import { useEffect, useState } from "react";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { readPromptResponse } from "./prompt-response-core.mjs";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

async function load(id: string): Promise<string> {
  if (cache.has(id)) return cache.get(id) as string;
  if (inflight.has(id)) return inflight.get(id) as Promise<string>;

  const url = `${import.meta.env.BASE_URL}data/prompts/${id}.json`;
  const promise = fetchWithTimeout(url, { cache: "force-cache", timeoutMs: 10000 })
    .then((r) => readPromptResponse(r, url))
    .then((prompt) => {
      cache.set(id, prompt);
      inflight.delete(id);
      return prompt;
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
  return load(id);
}

/** Warm the cache without subscribing to state. */
export function prefetchPrompt(id: string): void {
  if (!id || cache.has(id) || inflight.has(id)) return;
  void load(id).catch(() => {
    /* swallowed — error is surfaced when usePrompt is mounted */
  });
}

/** Get the cached prompt synchronously, or undefined. */
export function getCachedPrompt(id: string): string | undefined {
  return cache.get(id);
}

export interface UsePromptResult {
  prompt: string;
  loading: boolean;
  error: string;
}

export function usePrompt(id: string | null | undefined): UsePromptResult {
  const initial = id ? cache.get(id) : undefined;
  const [prompt, setPrompt] = useState(initial ?? "");
  const [loading, setLoading] = useState(!!id && !initial);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setPrompt("");
      setLoading(false);
      setError("");
      return;
    }

    const cached = cache.get(id);
    if (cached !== undefined) {
      setPrompt(cached);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    load(id)
      .then((text) => {
        if (cancelled) return;
        setPrompt(text);
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

  return { prompt, loading, error };
}
