import { memo, useState } from "react";
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
}

/**
 * `<img>` that:
 *   1. Serves a resized WebP from wsrv.nl (with srcset) for fast mobile/desktop loads.
 *   2. On proxy failure, swaps to the original URL.
 *   3. On second failure, surfaces the parent `onError` so it can show a placeholder.
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
}: SmartImgProps) {
  const [stage, setStage] = useState<0 | 1>(0); // 0 = optimized, 1 = original

  const baseW = baseWidth ?? (widths && widths.length > 0 ? Math.max(...widths) : width);

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
      onLoad={onLoad}
      onError={() => {
        // First error → fall back to the original (skip the proxy).
        if (stage === 0) setStage(1);
        else onError?.();
      }}
    />
  );
}

export const SmartImg = memo(SmartImgImpl);
