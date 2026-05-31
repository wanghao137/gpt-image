/**
 * `fetch` with a hard timeout via AbortController.
 *
 * Every runtime fetch in the app (prompt lazy-load, card copy, admin GitHub
 * calls) previously had no deadline — on a weak or stalled mobile connection
 * the request could hang indefinitely, leaving spinners stuck and buttons
 * disabled forever. This wraps `fetch` so a slow connection fails fast and the
 * UI can recover.
 *
 * The returned promise rejects with a `DOMException` named "AbortError" on
 * timeout (same as a manual abort), so callers can treat timeout and
 * cancellation uniformly.
 */
export interface FetchWithTimeoutOptions extends RequestInit {
  /** Milliseconds before the request is aborted. Default 10000. */
  timeoutMs?: number;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  { timeoutMs = 10000, signal, ...init }: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If the caller passed their own signal, abort our controller when it fires
  // so external cancellation still works alongside the timeout.
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
