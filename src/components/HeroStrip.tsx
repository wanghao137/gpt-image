import { useState } from "react";
import { Link } from "react-router-dom";
import type { PromptCase } from "../types";
import { rememberCaseReturn } from "../lib/caseReturn";
import { pickLocalWebp, transformUrl } from "../lib/img";
import { accessibleCaseLabel } from "../lib/labels";

/**
 * Resolve a thumbnail URL that works for both local /images/* paths and
 * external CDN URLs (YouMind). Local paths get the on-disk WebP variant;
 * external URLs go through wsrv.nl for resize + WebP + CN reachability.
 */
function thumbUrl(src: string, width: number): string {
  if (!src) return src;
  if (/^\/images\//i.test(src)) return pickLocalWebp(src, width);
  return transformUrl(src, { width });
}

interface HeroStripProps {
  cases: PromptCase[];
  /** Hard cap on items rendered. Anything beyond this never enters the DOM. */
  limit?: number;
}

/**
 * A horizontally-scrollable strip of square case thumbnails, sitting just
 * below the hero block. Modelled on the reference site
 * `gpt-image2.canghe.ai`'s landing strip — the goal is to show "there is
 * a lot more right beneath the hero" without forcing the user to scroll.
 *
 * Layout choices:
 *   - Full-bleed: we deliberately escape `container-narrow` (negative
 *     margins) so the rail extends to the viewport edges and the user
 *     can perceive horizontal overflow. Inside the rail, items still
 *     align with the page padding via a leading spacer.
 *   - Each tile is a soft 4:5 square with the case id pinned bottom-left.
 *     We don't show the title here — the goal is iconographic ("there is
 *     case #445, #444, #443…"), not textual.
 *   - `mask-fade-x` (defined in index.css) creates the soft fade at the
 *     left+right edges so the strip reads as "infinite" rather than
 *     "list ends here".
 *   - Snap on x so flick gestures feel native on iOS.
 *
 * We use `<img>` directly (not <SmartImg>) for two reasons:
 *   1. Each thumb is at most 240×300 CSS px so a single small WebP
 *      variant is enough — `pickLocalWebp(_, 320)` returns the 320 px
 *      file (~25 KB), so a 12-tile rail downloads ~300 KB total. That's
 *      cheap, and bypassing the <picture> machinery keeps the rail
 *      lightweight.
 *   2. Only the tiles visible in the initial viewport are eager/high priority.
 *      Off-screen rail items stay in the DOM but use native lazy loading and
 *      low fetch priority so they do not compete with the hero LCP image.
 */
export function HeroStrip({ cases, limit = 12 }: HeroStripProps) {
  const items = cases.slice(0, limit);
  // First N tiles are guaranteed visible in the initial viewport (before the
  // user scrolls horizontally), so they get a fetchPriority hint to jump the
  // network queue. The rest are still eager but auto priority.
  const PRIORITY_COUNT = 2;
  if (items.length === 0) return null;

  return (
    <section
      aria-label="最新案例条带"
      className="relative -mt-2 pb-8 sm:pb-10"
    >
      <div className="mask-fade-x">
        <div
          className="
            scrollbar-thin flex snap-x snap-mandatory gap-3 overflow-x-auto
            px-5 pb-3 pt-1 sm:gap-4 sm:px-8 lg:px-10
          "
          style={{
            // Slight overscroll padding so the last tile can fully animate
            // its hover lift without being clipped by the mask edge.
            scrollPaddingInline: "1.25rem",
          }}
        >
          {items.map((c, i) => (
            <StripTile key={c.id} item={c} priority={i < PRIORITY_COUNT} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StripTile({ item, priority }: { item: PromptCase; priority: boolean }) {
  // onError guard: if a tile's image fails to load for any reason, swap to a
  // subtle gradient so the rail never shows a permanent empty box.
  const [failed, setFailed] = useState(false);
  return (
    <Link
      to={`/case/${item.slug}`}
      onClick={() => rememberCaseReturn(item.id)}
      className="
        group relative block shrink-0 snap-start overflow-hidden rounded-xl
        border border-white/[0.06] bg-ink-900/40
        shadow-[0_10px_28px_-14px_rgba(0,0,0,0.7)]
        transition active:scale-[0.99] sm:hover:border-white/20
      "
      style={{ width: "8.5rem", height: "10.5rem" }}
      aria-label={accessibleCaseLabel(item)}
    >
      {failed ? (
        <div className="h-full w-full bg-gradient-to-br from-ink-800 to-ink-900" />
      ) : (
        <img
          src={thumbUrl(item.imageUrl, 320)}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          // `fetchpriority` (lowercased) is the HTML-spec attribute name; React
          // forwards it as-is. Priority hint jumps the network queue for tiles
          // visible in the initial horizontal viewport.
          {...({ fetchpriority: priority ? "high" : "low" } as {
            fetchpriority: "high" | "low";
          })}
          onError={() => setFailed(true)}
          width={272}
          height={336}
          className="
            h-full w-full object-cover transition duration-500
            group-hover:scale-[1.05]
          "
        />
      )}
      {/*
        Subtle bottom gradient on hover only — keeps the rail looking
        clean at rest. The previous revision overlaid a `#NNN` ID badge
        (canghe-style); per design feedback we drop the badge and let
        the thumbnail stand on its own.
      */}
      <span
        aria-hidden="true"
        className="
          pointer-events-none absolute inset-x-0 bottom-0 h-2/5
          bg-gradient-to-t from-ink-950/70 via-ink-950/25 to-transparent
          opacity-0 transition duration-300 group-hover:opacity-100
        "
      />
    </Link>
  );
}
