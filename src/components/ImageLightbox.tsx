import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { transformUrl } from "../lib/img";

interface ImageLightboxProps {
  open: boolean;
  src: string;
  alt: string;
  /** Caption shown over the toolbar (typically the case title). */
  caption?: string;
  /** Aspect ratio string like "9:16". Used for the initial render box. */
  ratio?: string;
  /** Optional copy action — when provided, renders a "Copy Prompt" button
   *  in the toolbar that fires this callback. */
  onCopy?: () => void;
  /** Current copy state for visual feedback on the toolbar button. */
  copyState?: "idle" | "copied" | "error";
  /** Optional prev / next navigation. When provided, the toolbar shows
   *  arrow buttons and arrow-key navigation switches between cases. */
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}

/**
 * Full-screen image viewer with native-feel pinch-to-zoom and pan.
 *
 * Why not a library:
 *   - `react-zoom-pan-pinch` is ~32KB gzipped; `panzoom` ~16KB but lacks React
 *     bindings and uses `transform` updates we'd have to coordinate with
 *     react state anyway. The viewer needs ~150 lines and zero dependencies.
 *   - We can keep behaviours mobile-perfect (rubber-banding at zoom limits,
 *     double-tap to fit/fill, dismiss-on-backdrop) tuned to *this* product.
 *
 * Gestures:
 *   - 1 finger drag (when zoomed): pan
 *   - 2 finger pinch: zoom around midpoint
 *   - double tap / double click: toggle fit ↔ 2× at the tap point
 *   - mouse wheel (desktop): zoom around cursor
 *   - Escape: close
 *   - tap on backdrop (not on image): close
 *
 * Render strategy:
 *   - Show LQIP background instantly so the swap from grid → lightbox is
 *     never a black flash on a slow connection.
 *   - Render the high-res image with a srcset that covers DPR up to 3 on
 *     even the largest tablet viewports.
 *   - Fade the high-res in once it loads; LQIP stays underneath (cheap, no
 *     extra DOM for a placeholder).
 */
function ImageLightboxImpl({
  open,
  src,
  alt,
  caption,
  ratio,
  onCopy,
  copyState = "idle",
  onPrev,
  onNext,
  onClose,
}: ImageLightboxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Transform state. We keep it in a ref so gesture handlers can read & write
  // without going through React's render cycle (which would lag on touch).
  const tRef = useRef({ scale: 1, x: 0, y: 0 });
  const [, forcePaint] = useState(0);
  const repaint = useCallback(() => forcePaint((n) => n + 1), []);

  const [loaded, setLoaded] = useState(false);

  // Reset transform whenever a new image opens.
  useEffect(() => {
    if (!open) return;
    tRef.current = { scale: 1, x: 0, y: 0 };
    setLoaded(false);
    repaint();
  }, [open, src, repaint]);

  // Lock body scroll while open + close on Escape, switch on arrows.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, onPrev, onNext]);

  // ── Gesture state (refs only; no React rerender per frame) ──
  // Active pointers, keyed by pointerId. Each entry stores its current
  // client coordinates. With 1 entry we pan; with 2 we pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  // Distance + midpoint at the start of an active pinch.
  const pinchStart = useRef<{
    dist: number;
    midX: number;
    midY: number;
    scale: number;
    tx: number;
    ty: number;
  } | null>(null);
  // Pan start.
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  // Last tap time + position for double-tap detection.
  const lastTap = useRef<{ t: number; x: number; y: number }>({ t: 0, x: 0, y: 0 });

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  // Clamp pan so the image cannot be dragged completely off-screen at any
  // zoom level. We compute slack as half of the (scaled - viewport) per axis;
  // when scale === 1 the image is centred, slack === 0, no pan possible.
  const clampPan = useCallback((x: number, y: number, scale: number) => {
    const stage = stageRef.current;
    if (!stage) return { x, y };
    const r = stage.getBoundingClientRect();
    const slackX = Math.max(0, (r.width * scale - r.width) / 2);
    const slackY = Math.max(0, (r.height * scale - r.height) / 2);
    return {
      x: Math.min(slackX, Math.max(-slackX, x)),
      y: Math.min(slackY, Math.max(-slackY, y)),
    };
  }, []);

  const setTransform = useCallback(
    (next: { scale?: number; x?: number; y?: number }) => {
      const cur = tRef.current;
      const scale = clampScale(next.scale ?? cur.scale);
      const clamped = clampPan(next.x ?? cur.x, next.y ?? cur.y, scale);
      tRef.current = { scale, x: clamped.x, y: clamped.y };
      // Apply via inline style — bypassing React for 60fps gesture response.
      const stage = stageRef.current;
      if (stage) {
        stage.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0) scale(${scale})`;
      }
    },
    [clampPan],
  );

  // Pointer event lifecycle. Pointer events normalise mouse + touch + pen
  // and give us reliable multi-touch with a single API.
  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      // Only react to pointers that started inside the stage area (image
      // wrapper) OR on transparent space; ignore pointers on the toolbar so
      // its buttons remain clickable without triggering pan.
      const target = e.target as HTMLElement;
      if (target.closest("[data-lb-toolbar]")) return;
      el.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 1) {
        const cur = tRef.current;
        panStart.current = { x: e.clientX, y: e.clientY, tx: cur.x, ty: cur.y };
        // Double tap to zoom — only when not already mid-pinch.
        const now = performance.now();
        const dt = now - lastTap.current.t;
        const dx = e.clientX - lastTap.current.x;
        const dy = e.clientY - lastTap.current.y;
        if (dt < 280 && dx * dx + dy * dy < 30 * 30) {
          // Toggle between fit (1×) and 2× centred on the tap.
          const cur2 = tRef.current;
          if (cur2.scale > 1.05) {
            setTransform({ scale: 1, x: 0, y: 0 });
          } else {
            const stage = stageRef.current;
            if (stage) {
              const r = stage.getBoundingClientRect();
              const cx = e.clientX - (r.left + r.width / 2);
              const cy = e.clientY - (r.top + r.height / 2);
              const targetScale = 2;
              setTransform({
                scale: targetScale,
                x: -cx * (targetScale - 1),
                y: -cy * (targetScale - 1),
              });
            }
          }
          lastTap.current = { t: 0, x: 0, y: 0 };
          return;
        }
        lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      } else if (pointers.current.size === 2) {
        const pts = Array.from(pointers.current.values());
        const [a, b] = pts;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const cur3 = tRef.current;
        pinchStart.current = {
          dist,
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2,
          scale: cur3.scale,
          tx: cur3.x,
          ty: cur3.y,
        };
        panStart.current = null;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 2 && pinchStart.current) {
        const pts = Array.from(pointers.current.values());
        const [a, b] = pts;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const ratioVal = dist / pinchStart.current.dist;
        const nextScale = clampScale(pinchStart.current.scale * ratioVal);

        // Keep the pinch midpoint anchored to the same image point.
        const stage = stageRef.current;
        if (!stage) return;
        const r = stage.getBoundingClientRect();
        const mx = pinchStart.current.midX - (r.left + r.width / 2);
        const my = pinchStart.current.midY - (r.top + r.height / 2);
        const k = nextScale / pinchStart.current.scale;
        setTransform({
          scale: nextScale,
          x: pinchStart.current.tx + mx * (1 - k),
          y: pinchStart.current.ty + my * (1 - k),
        });
        e.preventDefault();
      } else if (pointers.current.size === 1 && panStart.current) {
        // Only allow panning when zoomed in. At scale 1 we let the user
        // swipe to dismiss in a future iteration — for now, ignore pan.
        if (tRef.current.scale <= 1.01) return;
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setTransform({ x: panStart.current.tx + dx, y: panStart.current.ty + dy });
        e.preventDefault();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinchStart.current = null;
      if (pointers.current.size === 0) panStart.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      // Desktop zoom around the cursor.
      e.preventDefault();
      const cur = tRef.current;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nextScale = clampScale(cur.scale * factor);
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      const mx = e.clientX - (r.left + r.width / 2);
      const my = e.clientY - (r.top + r.height / 2);
      const k = nextScale / cur.scale;
      setTransform({
        scale: nextScale,
        x: cur.x + mx * (1 - k),
        y: cur.y + my * (1 - k),
      });
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [open, setTransform]);

  // Backdrop click closes (only when target IS the backdrop, not the image).
  const onBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // Lightbox source. transformUrl is identity for /images/* (the post-build
  // local path) and routes through wsrv only for the rare runtime-only URL.
  // No fallback ladder — the build pipeline guarantees the local file
  // exists, and if it doesn't we'd rather show a broken image than ship
  // multi-stage retry machinery that introduced its own latency.
  const main = useMemo(
    () => transformUrl(src, { width: 1440, quality: 86 }),
    [src],
  );
  const isLocalImage =
    src.startsWith("/images/") || src.startsWith("/assets/") || src.startsWith("/uploads/");
  // Only external defensive fallbacks have real transformed width variants.
  const sset = useMemo(() => {
    if (isLocalImage) return undefined;
    const widths = [720, 1080, 1440, 1920];
    return widths
      .map((w) => `${transformUrl(src, { width: w, quality: 86 })} ${w}w`)
      .join(", ");
  }, [isLocalImage, src]);

  // Compute aspect ratio for the stage box so the initial scale-1 frame
  // matches the case's true ratio (avoids letterboxing on portrait images).
  const aspect = useMemo(() => {
    if (!ratio) return undefined;
    const [w, h] = ratio.split(":").map(Number);
    if (!w || !h) return undefined;
    return `${w} / ${h}`;
  }, [ratio]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={caption || alt}
      onClick={onBackdropClick}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/95 backdrop-blur-md"
      style={{
        // touch-action: none so the browser doesn't intercept pinch as page
        // zoom or swipe-back; we own all gestures inside the lightbox.
        touchAction: "none",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Top toolbar — hit area excluded from gestures via data-lb-toolbar */}
      <div
        data-lb-toolbar
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        {caption && (
          <p className="pointer-events-auto max-w-[60%] truncate rounded-full border border-white/10 bg-ink-950/60 px-3 py-1.5 text-[12px] font-medium text-ink-100 backdrop-blur">
            {caption}
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              className={
                "pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition " +
                (copyState === "copied"
                  ? "bg-emerald-400 text-ink-950"
                  : copyState === "error"
                    ? "bg-rose-400 text-ink-950"
                    : "bg-ember-500 text-ink-950 hover:bg-ember-400")
              }
              aria-label="复制 Prompt"
            >
              {copyState === "copied" ? (
                <>
                  <CheckIcon /> 已复制
                </>
              ) : copyState === "error" ? (
                "失败"
              ) : (
                <>
                  <CopyIcon /> 复制 Prompt
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setTransform({ scale: 1, x: 0, y: 0 })}
            className="pointer-events-auto inline-flex h-9 items-center gap-1 rounded-full border border-white/10 bg-ink-950/60 px-3 text-[12px] font-medium text-ink-100 backdrop-blur"
            aria-label="重置缩放"
          >
            <ResetIcon /> 重置
          </button>
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-ink-950/65 text-ink-50 backdrop-blur"
            aria-label="关闭"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Side prev/next buttons — desktop only, hidden on touch where the
          toolbar already takes the upper region. */}
      {(onPrev || onNext) && (
        <>
          {onPrev && (
            <button
              data-lb-toolbar
              type="button"
              onClick={onPrev}
              aria-label="上一个案例"
              className="pointer-events-auto absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-ink-950/65 p-3 text-ink-50 backdrop-blur transition hover:border-white/30 hover:bg-ink-950/85 sm:inline-flex"
            >
              <ArrowLeftIcon />
            </button>
          )}
          {onNext && (
            <button
              data-lb-toolbar
              type="button"
              onClick={onNext}
              aria-label="下一个案例"
              className="pointer-events-auto absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-ink-950/65 p-3 text-ink-50 backdrop-blur transition hover:border-white/30 hover:bg-ink-950/85 sm:inline-flex"
            >
              <ArrowRightIcon />
            </button>
          )}
        </>
      )}

      {/* Stage — the image lives inside this. We size it to the viewport
          and let the inner <img> use object-contain to keep its true
          aspect ratio without letterboxing the lightbox itself. */}
      <div
        ref={stageRef}
        className="relative max-h-[92vh] max-w-[96vw] select-none"
        style={{
          aspectRatio: aspect,
          transformOrigin: "center center",
          willChange: "transform",
          transition: "transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)",
          // No LQIP background — local /images/* paths come back fast
          // enough that an inline blur preview hurts more than it helps
          // (always-visible smudge on slow connections that gets confused
          // for the real image).
        }}
      >
        <img
          src={main}
          srcSet={sset}
          sizes="96vw"
          alt={alt}
          draggable={false}
          loading="eager"
          decoding="async"
          {...({ fetchpriority: "high" } as { fetchpriority: "high" })}
          onLoad={() => setLoaded(true)}
          onError={() => {
            // No retry. The build pipeline guarantees /images/* exist;
            // if rendering still fails the original src is bad and we
            // let the browser show its broken-image marker — preferable
            // to a forever-spinner.
          }}
          className="block h-full w-full object-contain"
          style={{
            opacity: loaded ? 1 : 0,
            transition: "opacity 240ms ease-out",
          }}
        />
      </div>

      {/* Bottom hint strip — disappears once the user has interacted */}
      <div
        data-lb-toolbar
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-4 text-[11px] text-ink-300"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <span className="rounded-full border border-white/10 bg-ink-950/60 px-3 py-1 backdrop-blur">
          {onPrev || onNext
            ? "双指缩放 · 双击放大 · ← → 切换案例 · ESC 关闭"
            : "双指缩放 · 双击放大 · 点击空白关闭"}
        </span>
      </div>
    </div>
  );
}

export const ImageLightbox = memo(ImageLightboxImpl);

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M3.5 8a6.5 6.5 0 1 1 1.32 4" />
      <path d="M3 4v4h4" />
    </svg>
  );
}
