import { memo, useEffect, useMemo, useRef, useState } from "react";
import { lqipUrl, mirrorOrigin, optimizeImage, srcSetFor } from "../lib/img";

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
  /**
   * className is applied to the *wrapper* (which also hosts the LQIP blur
   * background). The inner <img> always covers the wrapper via object-cover
   * so passing `absolute inset-0 h-full w-full` (the existing call pattern)
   * positions both placeholder + image correctly.
   */
  className?: string;
  style?: React.CSSProperties;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  decoding?: "sync" | "async" | "auto";
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
  /**
   * If the proxied image hasn't loaded within this many ms, promote to the
   * mirror-origin (jsDelivr) fallback. wsrv.nl can hang on Chinese networks
   * without firing `onError`; this manual timeout is what keeps users from
   * staring at a black tile.
   *
   * Default lowered from 3500ms → 1800ms after RUM showed p75 wsrv first
   * byte for our payload sizes is ~700ms; anything past 1.8s is almost
   * certainly stuck.
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
 *   stage 0 (fast path):    optimized WebP via wsrv.nl (size-targeted srcset)
 *   stage 1 (mirror):       jsDelivr / origin URL — fast in mainland China
 *   stage 2 (last resort):  surface onError to the parent (parent shows fallback)
 *
 * The wsrv → mirror fallback matters for users opening the site inside WeChat
 * or on networks where the proxy is throttled. Per RUM data the proxy is
 * unreliable for ~5–8% of mainland China requests; on those connections the
 * jsDelivr origin we route through is consistently sub-second.
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
  proxyTimeoutMs = 1800,
  lqip = true,
}: SmartImgProps) {
  const [stage, setStage] = useState<0 | 1>(0);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<number | null>(null);
  const loadedRef = useRef(false);

  // Arm a timeout while we're on the proxied stage. If the image still hasn't
  // fired `load` by then, promote to the mirror origin.
  useEffect(() => {
    loadedRef.current = false;
    setLoaded(false);
    if (stage !== 0 || !proxyTimeoutMs) return;
    timerRef.current = window.setTimeout(() => {
      if (!loadedRef.current) setStage(1);
    }, proxyTimeoutMs);
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [stage, proxyTimeoutMs, src]);

  // When a `srcset` is in play the browser picks one of the widths from the
  // set; the `src` attribute is only the fallback for browsers without
  // `srcset` support. Keep `src` at the *smallest* width so we don't waste
  // bytes on a redundant request when the browser also pre-resolves `src`.
  const baseW =
    baseWidth ??
    (widths && widths.length > 0 ? Math.min(...widths) : width);

  // Pre-compute the LQIP URL once. Cheap (single string ops) but stable.
  const placeholderUrl = useMemo(() => (lqip ? lqipUrl(src) : ""), [lqip, src]);

  const finalSrc =
    stage === 0 ? optimizeImage(src, { width: baseW, quality }) : mirrorOrigin(src);
  const finalSrcSet =
    stage === 0 && widths && widths.length > 0
      ? srcSetFor(src, widths, { quality })
      : undefined;

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
          // Always cover the wrapper. The wrapper is sized by the consumer
          // (typically via `aspect-[4/5]` + absolute fill).
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
          if (stage === 0) setStage(1);
          else onError?.();
        }}
      />
    </div>
  );
}

export const SmartImg = memo(SmartImgImpl);
