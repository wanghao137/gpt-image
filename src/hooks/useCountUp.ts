import { useEffect, useState } from "react";

/**
 * Animates a number from 0 to `target` over `duration` ms using rAF.
 *
 * Design notes:
 *   - Respects `prefers-reduced-motion` — returns the final value immediately.
 *   - Defers the animation until the main thread is idle (or a 600ms safety
 *     timer fires). Why: the previous version started a 60fps rAF loop the
 *     instant the component mounted, which on mobile means we were spending
 *     ~16ms per frame on a setState while the LCP image was still being
 *     decoded. Deferring removes that contention without changing the
 *     visible result — users on fast paths see the same animation, users on
 *     slow paths see the final value sooner.
 *   - The 600ms safety net guarantees the count-up still runs even if
 *     `requestIdleCallback` never fires (Safari without the polyfill).
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      return;
    }

    let raf = 0;
    let idleHandle: number | undefined;
    let safetyTimer: number | undefined;
    let started = false;

    const start = () => {
      if (started) return;
      started = true;
      const begin = performance.now();
      const tick = (t: number) => {
        const elapsed = t - begin;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    type IdleHost = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    const host = window as IdleHost;
    if (typeof host.requestIdleCallback === "function") {
      // 1500ms timeout inside rIC's own deadline so we still land within ~1.5s
      // even if the page is busy. The outer 600ms safety net is still useful
      // because some implementations can blow past their requested timeout
      // when a long task is in flight.
      idleHandle = host.requestIdleCallback(start, { timeout: 1500 });
    }
    safetyTimer = window.setTimeout(start, 600);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (safetyTimer !== undefined) window.clearTimeout(safetyTimer);
      if (idleHandle !== undefined && typeof host.cancelIdleCallback === "function") {
        host.cancelIdleCallback(idleHandle);
      }
    };
  }, [target, duration]);

  return value;
}
