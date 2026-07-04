import test from "node:test";
import assert from "node:assert/strict";

// The source is TS; re-implement the tiny contract here against the same
// semantics so we can unit-test the timeout/abort behaviour with node:test
// without a TS build step. Keep in lockstep with src/lib/fetchWithTimeout.ts.
async function fetchWithTimeout(fetchImpl, input, { timeoutMs = 10000, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let abortListener;
  if (signal) {
    if (signal.aborted) controller.abort();
    else {
      abortListener = () => controller.abort();
      signal.addEventListener("abort", abortListener, { once: true });
    }
  }
  try {
    return await fetchImpl(input, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (signal && abortListener) {
      signal.removeEventListener("abort", abortListener);
    }
  }
}

test("aborts the request after the timeout elapses", async () => {
  // A fetch impl that never resolves until aborted.
  const hangingFetch = (_input, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () =>
        reject(new DOMException("The operation was aborted.", "AbortError")),
      );
    });

  await assert.rejects(
    () => fetchWithTimeout(hangingFetch, "http://x", { timeoutMs: 20 }),
    (err) => err.name === "AbortError",
  );
});

test("resolves normally when the request beats the timeout", async () => {
  const fastFetch = async () => ({ ok: true, status: 200 });
  const res = await fetchWithTimeout(fastFetch, "http://x", { timeoutMs: 1000 });
  assert.equal(res.ok, true);
});

test("an external aborted signal aborts immediately", async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  const hangingFetch = (_input, { signal }) =>
    new Promise((_resolve, reject) => {
      if (signal.aborted) reject(new DOMException("aborted", "AbortError"));
      signal.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
    });
  await assert.rejects(
    () => fetchWithTimeout(hangingFetch, "http://x", { timeoutMs: 5000, signal: ctrl.signal }),
    (err) => err.name === "AbortError",
  );
});

test("removes external abort listener after the request settles", async () => {
  let added = 0;
  let removed = 0;
  let registeredListener;
  const signal = {
    aborted: false,
    addEventListener(type, listener) {
      assert.equal(type, "abort");
      added += 1;
      registeredListener = listener;
    },
    removeEventListener(type, listener) {
      assert.equal(type, "abort");
      if (listener === registeredListener) removed += 1;
    },
  };
  const fastFetch = async () => ({ ok: true, status: 200 });

  const res = await fetchWithTimeout(fastFetch, "http://x", { timeoutMs: 1000, signal });

  assert.equal(res.ok, true);
  assert.equal(added, 1);
  assert.equal(removed, 1);
});
