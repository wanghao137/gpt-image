import { useEffect, useState } from "react";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

async function load(id: string): Promise<string> {
  if (cache.has(id)) return cache.get(id) as string;
  if (inflight.has(id)) return inflight.get(id) as Promise<string>;

  const url = `${import.meta.env.BASE_URL}data/prompts/${id}.json`;
  const promise = fetch(url, { cache: "force-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<{ prompt: string }>;
    })
    .then((data) => {
      cache.set(id, data.prompt);
      inflight.delete(id);
      return data.prompt;
    })
    .catch((err) => {
      inflight.delete(id);
      throw err;
    });

  inflight.set(id, promise);
  return promise;
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
