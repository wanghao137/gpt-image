import { memo, useEffect, useRef, useState } from "react";
import { optimizeImage, srcSetFor } from "../lib/img";

interface SmartImgProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Render widths used to build `srcset`. */
  widths?: number[];
  /** Width used for the fallback `src` attribute (largest reasonable). */
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
   * If the proxied image hasn't loaded within this many ms, promote to the
   * original-URL fallback. Set to 0 to disable. wsrv.nl can occasionally hang
   * on Chinese networks without firing `onError`, so we time out manually.
   */
  proxyTimeoutMs?: number;
}

/**
 * `<img>` with three-stage fallback:
 *   stage 0: optimized WebP via wsrv.nl (size-targeted srcset, fastest)
 *   stage 1: original URL (handles wsrv outages — common on Chinese networks)
 *   stage 2: surface onError to the parent so it can show a placeholder
 *
 * The wsrv→original fallback matters for users opening the site inside WeChat
 * or on networks where the proxy is throttled. Per RUM data the proxy is
 * unreliable for ~5–8% of mainland China requests.
 *
 * We additionally arm a load timeout because TCP/TLS hangs to wsrv don't
 * always surface as `onError` — the browser just keeps the request open and
 * users see a black tile until they refresh.
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
  proxyTimeoutMs = 3500,
}: SmartImgProps) {
  const [stage, setStage] = useState<0 | 1>(0);
  const timerRef = useRef<number | null>(null);
  const loadedRef = useRef(false);

  // Arm a timeout while we're on the proxied stage. If the image still hasn't
  // fired `load` by then, promote to the origin URL.
  useEffect(() => {
    loadedRef.current = false;
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

  const finalSrc =
    stage === 0 ? optimizeImage(src, { width: baseW, quality }) : src;
  const finalSrcSet =
    stage === 0 && widths && widths.length > 0
      ? srcSetFor(src, widths, { quality })
      : undefined;

  return (
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
      className={className}
      style={style}
      onLoad={() => {
        loadedRef.current = true;
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
  );
}

export const SmartImg = memo(SmartImgImpl);
