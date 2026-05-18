import { memo, useEffect, useMemo, useRef, useState } from "react";
import { lqipUrl, rawTransformUrl, transformUrl } from "../lib/img";

interface SmartImgProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Render widths used to build `srcset`. */
  widths?: number[];
  /** Width used for the fallback `src` attribute (smallest reasonable). */
  baseWidth?: number;
  sizes?: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  decoding?: "sync" | "async" | "auto";
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
  /**
   * Per-stage timeout. If the current source hasn't fired `load` by then,
   * we promote to the next stage. Defaults to 2200ms — long enough that a
   * cold edge fetch + slow Chinese mobile uplink gets a fair shot, short
   * enough that we don't strand users on a stuck CDN.
   */
  proxyTimeoutMs?: number;
  /**
   * Show a low-quality (~24px) blurred placeholder behind the real image
   * until it loads. Massively improves perceived speed on long lists.
   * Disable for hero images where you'd rather show a clean skeleton.
   */
  lqip?: boolean;
}

/**
 * `<img>` with three-stage fallback and inline blur-up placeholder.
 *
 *   stage 0 (fast path):    `transformUrl()` — wsrv resize wrapped in our
 *                           own Cloudflare Pages edge proxy. After the cold
 *                           fetch (any user, anywhere), the resized WebP is
 *                           cached on the CF edge for a year. Mainland-China
 *                           users hit HKG / NRT / SIN POPs in <50ms.
 *
 *   stage 1 (transform):    `rawTransformUrl()` — wsrv resize *without* the
 *                           edge wrap. Slower for cold paths in China but a
 *                           useful second opinion when the edge function is
 *                           failing for any reason (deploy mid-rollout etc.)
 *
 *   stage 2 (origin):       Raw src URL — could be raw.github (slow in CN)
 *                           or /uploads/<file>.png (fast but unresized,
 *                           potentially 2–5MB). Last ditch only.
 *
 * The fallback ladder is the part that solves "image doesn't load at all".
 * Even if a brand-new CF POP is mid-routing-flap, we still have two more
 * URLs to try before giving up.
 *
 * Layout contract:
 *   The outer wrapper inherits the className/style passed in. Existing call
 *   sites use `absolute inset-0 h-full w-full` to size it inside an
 *   `aspect-ratio` parent. The inner <img> always covers the wrapper via
 *   inline object-fit: cover. The LQIP, when enabled, paints as a CSS
 *   background on the wrapper, so the blur is visible immediately and gets
 *   composited on the GPU — no extra DOM, no extra layout work.
 */
function SmartImgImpl({
  src,
  alt,
  width,
  height,
  widths,
  baseWidth,
  sizes,
  className,
  style,
  loading = "lazy",
  fetchPriority,
  decoding = "async",
  quality,
  onLoad,
  onError,
  proxyTimeoutMs = 2200,
  lqip = true,
}: SmartImgProps) {
  type Stage = 0 | 1 | 2;
  const [stage, setStage] = useState<Stage>(0);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<number | null>(null);
  const loadedRef = useRef(false);

  // Determine routing characteristics up front so the hooks below can read
  // them. We only treat the src as "local-already-optimized" if it points to
  // an *already-resized* asset under /assets (Vite-hashed bundles). Raw user
  // uploads at /uploads/<file>.png are routinely 2–5MB PNGs and MUST be
  // routed through our transform pipeline like any other image.
  const isAssetPath = src.startsWith("/assets/");

  // Reset on src change.
  useEffect(() => {
    setStage(0);
    setLoaded(false);
    loadedRef.current = false;
  }, [src]);

  // Arm a timeout per stage. If the current src hasn't fired `load` by then,
  // we promote to the next stage. Stage 2 (origin) gets no timer — it's the
  // last resort and we let the browser surface its own error.
  //
  // We skip the timer for /assets/* paths (Vite-hashed bundles) because all
  // three stages render the same URL — promoting would just re-mount the
  // same <img> for no benefit. Note: /uploads/* is NOT in this category;
  // those go through wsrv resize like any external image.
  useEffect(() => {
    loadedRef.current = false;
    setLoaded(false);
    if (stage >= 2 || !proxyTimeoutMs || isAssetPath) return;
    timerRef.current = window.setTimeout(() => {
      if (!loadedRef.current) {
        setStage((s) => (s < 2 ? ((s + 1) as Stage) : s));
      }
    }, proxyTimeoutMs);
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [stage, proxyTimeoutMs, src, isAssetPath]);

  // The width used for the `src` attribute (smallest reasonable — the
  // browser will only use this if it doesn't support srcset, or as the LCP
  // candidate hint). We default to the smallest widths entry so we don't
  // waste bytes on a pre-resolution that gets replaced by srcset anyway.
  const baseW =
    baseWidth ??
    (widths && widths.length > 0 ? Math.min(...widths) : width);

  // Pre-compute the LQIP URL once per src. Cheap (just string ops).
  // We always emit one for HTTP URLs and uploads; the only path we skip is
  // /assets/* (Vite-hashed bundles), which don't benefit from a blur preview.
  const placeholderUrl = useMemo(
    () => (lqip && !isAssetPath ? lqipUrl(src) : ""),
    [lqip, isAssetPath, src],
  );

  // Compute the URLs for each stage. We materialise them all so render is
  // pure and deterministic — no async work in the hot path.
  //
  //   stage 0 — transformUrl: COS HK for /uploads (China-friendly, single
  //             hop, on-the-fly WebP), wsrv for external URLs.
  //   stage 1 — rawTransformUrl: forced wsrv fallback. Useful when COS is
  //             unreachable from the user's network for any reason.
  //   stage 2 — original src verbatim. Last resort.
  //
  // For /assets/* (Vite-hashed bundles) all three stages pass through to the
  // same URL.
  const stageUrls = useMemo(() => {
    if (isAssetPath) return [src, src, src] as const;
    const stage0 = transformUrl(src, { width: baseW, quality });
    const stage1 = rawTransformUrl(src, { width: baseW, quality });
    return [stage0, stage1, src] as const;
  }, [src, baseW, quality, isAssetPath]);

  const stageSrcSets = useMemo(() => {
    if (!widths || widths.length === 0) return ["", "", ""] as const;
    if (isAssetPath) {
      const same = widths.map((w) => `${src} ${w}w`).join(", ");
      return [same, same, same] as const;
    }
    const stage0Set = widths
      .map((w) => `${transformUrl(src, { width: w, quality })} ${w}w`)
      .join(", ");
    const stage1Set = widths
      .map((w) => `${rawTransformUrl(src, { width: w, quality })} ${w}w`)
      .join(", ");
    const originSet = widths.map((w) => `${src} ${w}w`).join(", ");
    return [stage0Set, stage1Set, originSet] as const;
  }, [src, widths, quality, isAssetPath]);

  const finalSrc = stageUrls[stage];
  const finalSrcSet = stageSrcSets[stage] || undefined;

  const showPlaceholder = lqip && !!placeholderUrl && !loaded;

  // The wrapper takes the consumer's className/style so the existing
  // `absolute inset-0 h-full w-full` patterns keep working. We layer the
  // LQIP as a CSS background (no extra DOM); when the real image fires
  // `load` we fade it in on top and drop the placeholder.
  const wrapperStyle: React.CSSProperties = {
    ...style,
    overflow: "hidden",
    ...(showPlaceholder
      ? {
          backgroundImage: `url(${placeholderUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : null),
  };

  return (
    <div className={className} style={wrapperStyle}>
      <img
        // We change the `key` per stage so React re-creates the <img>; without
        // this Chrome will keep the broken in-flight request and refuse to
        // re-fire `load` on the new src (a long-standing browser quirk with
        // mid-flight src swaps on the same DOM node).
        key={`${src}::${stage}`}
        src={finalSrc}
        srcSet={finalSrcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: loaded ? 1 : 0,
          transition: "opacity 380ms ease-out",
        }}
        onLoad={() => {
          loadedRef.current = true;
          setLoaded(true);
          if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          onLoad?.();
        }}
        onError={() => {
          if (stage < 2) {
            setStage((s) => ((s + 1) as Stage));
          } else {
            onError?.();
          }
        }}
      />
    </div>
  );
}

export const SmartImg = memo(SmartImgImpl);
