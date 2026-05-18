import { memo, useState } from "react";
import { rawTransformUrl } from "../lib/img";

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
  /** No-ops, kept for API compatibility with existing call sites. */
  lqip?: boolean;
  proxyTimeoutMs?: number;
}

/**
 * Image with a calm loading state and a single source URL.
 *
 * Background:
 *   We tried to be clever — wsrv proxy, Cloudflare Pages Function, COS HK,
 *   3-stage fallback ladders, LQIP blur previews. Net result on Chinese
 *   mobile networks: slower, jankier, and a permanent grey smudge that
 *   made users think the page was already loaded. The reference site we
 *   were trying to beat (gpt-image2.canghe.ai) ships <300ms TTFB by doing
 *   one boring thing: bake every image into the deploy.
 *
 *   Now we do the same. `scripts/build-images.mjs` runs in `prebuild`,
 *   downloads every upstream image, resizes to 1200 px max, encodes JPEG
 *   q=80 mozjpeg, and writes `public/images/case<id>.jpg`. cases.json's
 *   `imageUrl` is rewritten in place. By the time this component renders,
 *   `src` is already a same-origin path — no transforms, no proxies, no
 *   fallbacks needed.
 *
 * What this component still does:
 *   - Show a tiny ember spinner over a dark skeleton background while the
 *     image is in-flight. Disappears the instant `load` fires.
 *   - For external HTTP URLs the build pipeline somehow missed (defensive
 *     edge case), route through wsrv as a one-off transform — single try,
 *     no retry ladder.
 *
 * Layout contract:
 *   The wrapper inherits className/style. Existing call sites pass
 *   `absolute inset-0 h-full w-full` to fill an aspect-ratio parent.
 *   The inner <img> always covers the wrapper via inline object-cover.
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
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // Decide the request URL. Local /images/* and /assets/* render as-is —
  // they're already optimised on disk. Anything else (an http URL the
  // build pipeline didn't get to rewrite) goes through wsrv with a single
  // size-targeted request.
  const isLocal =
    src.startsWith("/images/") || src.startsWith("/assets/") || src.startsWith("/uploads/");

  const baseW =
    baseWidth ??
    (widths && widths.length > 0 ? Math.min(...widths) : width);

  const finalSrc = isLocal
    ? src
    : rawTransformUrl(src, { width: baseW, quality });

  // Local paths have no width variants — emit a srcset with the same URL
  // at every width descriptor so the browser still gets a hint about which
  // candidate to pick (the file is one and the same).
  const finalSrcSet =
    !widths || widths.length === 0
      ? undefined
      : isLocal
        ? widths.map((w) => `${src} ${w}w`).join(", ")
        : widths
            .map((w) => `${rawTransformUrl(src, { width: w, quality })} ${w}w`)
            .join(", ");

  return (
    <div
      className={className}
      style={{
        ...style,
        overflow: "hidden",
        position: style?.position ?? "relative",
        // Calm dark skeleton. No animation — saves CPU on long mobile feeds.
        backgroundColor: loaded ? undefined : "#1a1715",
      }}
    >
      {!loaded && !errored && <SpinnerOverlay />}
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
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: loaded ? 1 : 0,
          transition: "opacity 220ms ease-out",
        }}
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        onError={() => {
          setErrored(true);
          onError?.();
        }}
      />
    </div>
  );
}

/**
 * Centred ember spinner. Matches the homepage boot loader (.boot::after
 * in index.html) so the visual language is consistent from boot through
 * lazy-loaded card images.
 */
function SpinnerOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "2px solid rgba(217,119,87,0.18)",
          borderTopColor: "#d97757",
          animation: "smartImgSpin 0.9s linear infinite",
        }}
      />
      <style>{`
        @keyframes smartImgSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export const SmartImg = memo(SmartImgImpl);
