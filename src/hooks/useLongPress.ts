import { useCallback, useEffect, useRef } from "react";

export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export interface UseLongPressOptions {
  /** Threshold in ms before the long-press fires. Default 380ms. */
  thresholdMs?: number;
  /** Allowed jitter in px before the gesture is cancelled. Default 8px. */
  moveTolerancePx?: number;
  /**
   * When true, also fire on a desktop right-click (replacing the browser's
   * default context menu). Defaults to true — the same UI is the most
   * useful "secondary actions" surface on either input modality.
   */
  hijackContextMenu?: boolean;
  /** Called when the long-press threshold is reached. */
  onLongPress: (e: React.PointerEvent | React.MouseEvent) => void;
}

/**
 * Long-press / right-click gesture detector with motion cancellation.
 *
 * Why we don't use `onContextMenu` alone: iOS Safari fires `contextmenu` on
 * a 500ms long-press, but it also triggers the system "look up / share"
 * sheet first, and on iPadOS doesn't fire at all without disabling text
 * selection. A pointer-event timer gives us identical behaviour on every
 * platform, plus the option to fire BEFORE the OS's own long-press menu
 * appears (380ms < 500ms iOS default).
 *
 * Spread the returned object onto a trigger element. Also calls
 * `preventDefault` on contextmenu so the browser's right-click menu doesn't
 * race ours on desktop.
 */
export function useLongPress({
  onLongPress,
  thresholdMs = 380,
  moveTolerancePx = 8,
  hijackContextMenu = true,
}: UseLongPressOptions): LongPressHandlers {
  const timer = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const triggered = useRef(false);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    startPos.current = null;
  }, []);

  useEffect(() => () => clear(), [clear]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore non-primary buttons (right-click handled via onContextMenu).
      if (e.button !== 0 && e.pointerType === "mouse") return;
      triggered.current = false;
      startPos.current = { x: e.clientX, y: e.clientY };
      // Snapshot the original target — fired callback gets a clone-safe
      // pointer event reference. Persist via React's pooled event semantics
      // is no longer required (React 17+), so passing through `e` is OK.
      timer.current = window.setTimeout(() => {
        triggered.current = true;
        if ("vibrate" in navigator) {
          try { navigator.vibrate?.(14); } catch { /* noop */ }
        }
        onLongPress(e);
      }, thresholdMs);
    },
    [onLongPress, thresholdMs],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPos.current || timer.current === null) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (dx * dx + dy * dy > moveTolerancePx * moveTolerancePx) {
        clear();
      }
    },
    [clear, moveTolerancePx],
  );

  const onPointerUp = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerLeave = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerCancel = useCallback(() => {
    clear();
  }, [clear]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!hijackContextMenu) return;
      e.preventDefault();
      if (triggered.current) return;
      onLongPress(e);
    },
    [hijackContextMenu, onLongPress],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
    onContextMenu,
  };
}
