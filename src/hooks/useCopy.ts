import { useCallback, useEffect, useRef, useState } from "react";
import { toast as toastBus, type ToastAction } from "./useToast";

export type CopyState = "idle" | "copied" | "error";

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("copy failed");
}

export interface UseCopyOptions {
  /** When false, suppress the global toast for this hook instance. */
  toast?: boolean;
  /** Override the success toast title. */
  successTitle?: string;
  /** Override the success toast description. */
  successDescription?: string;
  /** Action button shown inside the toast (e.g. "去 ChatGPT 粘贴"). */
  successAction?: ToastAction;
}

/**
 * Clipboard write hook. Three jobs:
 *   1. Cross-browser copy (Clipboard API + execCommand fallback).
 *   2. Surface a per-component "copied" / "error" state for inline feedback
 *      (used by buttons that render a check or a colour swap).
 *   3. Fire a global toast on success so the user always gets a *page-level*
 *      confirmation regardless of which copy button they pressed. The
 *      previous version only swapped a button label, which on a 4-up grid
 *      was easy to miss — especially after a long-press menu copied off-card.
 *
 * Compat: the legacy single-arg signature `useCopy(1500)` still works.
 * Pass an object as the second arg to customise the toast.
 */
export function useCopy(resetMs = 1500, options: UseCopyOptions = {}) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<number | null>(null);
  const optsRef = useRef(options);
  // Keep latest options without forcing every consumer to memoise.
  optsRef.current = options;

  const copy = useCallback(
    async (text: string, perCallOptions?: UseCopyOptions) => {
      // Per-call options win over hook-level options, both are optional.
      const opts: UseCopyOptions = { ...optsRef.current, ...perCallOptions };
      try {
        await writeClipboard(text);
        setState("copied");

        // Subtle haptic on supporting devices (Android Chrome, some iOS PWAs).
        // 12ms reads as "tactile confirmation" without feeling like an alert
        // buzz; bumped from 8ms because the previous value was below the
        // perceptual threshold on most devices.
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate?.(12);
          } catch {
            /* some browsers throw on insecure contexts; ignore */
          }
        }

        if (opts.toast !== false) {
          toastBus.success(opts.successTitle ?? "已复制", {
            description: opts.successDescription,
            action: opts.successAction,
          });
        }
      } catch {
        setState("error");
        if (opts.toast !== false) {
          toastBus.error("复制失败", {
            description: "浏览器拒绝写入剪贴板，长按手动复制。",
          });
        }
      }
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setState("idle"), resetMs);
    },
    [resetMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { state, copy };
}
