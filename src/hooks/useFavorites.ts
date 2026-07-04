import { useCallback, useEffect, useRef, useState } from "react";
import { parseFavoriteIds } from "./favorites-core.mjs";

const KEY = "gpt-image-gallery:favorites:v1";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    return parseFavoriteIds(raw);
  } catch {
    return new Set();
  }
}

/**
 * Favorites are persisted to localStorage and shared across all pages by
 * subscribing to the `storage` event so multiple tabs stay in sync without
 * needing a full client-side store. SSR-safe: `read()` returns an empty set
 * during render and the real set hydrates in the first effect tick.
 */
export function useFavorites() {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  // Gate the persistence effect until the initial read has hydrated `ids`.
  // Without this gate the write effect fires on the very first render with the
  // empty initial set and clobbers any previously-stored favorites in
  // localStorage *before* the read effect below restores them — a brief
  // [] overwrite that races storage events across tabs.
  const hydratedRef = useRef(false);

  useEffect(() => {
    setIds(read());
    hydratedRef.current = true;
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setIds(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip the write until we've hydrated from storage, so we never persist
    // the empty initial set over real data.
    if (!hydratedRef.current) return;
    window.localStorage.setItem(KEY, JSON.stringify(Array.from(ids)));
  }, [ids]);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  return { ids, toggle, has };
}
