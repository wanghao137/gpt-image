import { Link } from "react-router-dom";
import type { PromptCase } from "../types";
import { pickLocalWebp } from "../lib/img";

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
 *   2. `loading="lazy"` + `decoding="async"` lets the browser stagger
 *      decoding work behind the hero LCP image.
 */
export function HeroStrip({ cases, limit = 12 }: HeroStripProps) {
  const items = cases.slice(0, limit);
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
          {items.map((c) => (
            <StripTile key={c.id} item={c} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StripTile({ item }: { item: PromptCase }) {
  return (
    <Link
      to={`/case/${item.slug}`}
      className="
        group relative block shrink-0 snap-start overflow-hidden rounded-xl
        border border-white/[0.06] bg-ink-900/40
        shadow-[0_10px_28px_-14px_rgba(0,0,0,0.7)]
        transition active:scale-[0.99] sm:hover:border-white/20
      "
      style={{ width: "8.5rem", height: "10.5rem" }}
      aria-label={`${item.title} · 案例 ${item.id}`}
    >
      <img
        src={pickLocalWebp(item.imageUrl, 320)}
        alt=""
        loading="lazy"
        decoding="async"
        width={272}
        height={336}
        className="
          h-full w-full object-cover transition duration-500
          group-hover:scale-[1.05]
        "
      />
      {/* Bottom gradient + ID badge. The badge mirrors canghe's style:
          a small white `#NNN` label on a dark gradient bottom strip. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink-950/85 via-ink-950/35 to-transparent"
      />
      <span
        className="
          absolute bottom-2 left-2 inline-flex items-center
          rounded-md bg-ink-950/60 px-1.5 py-0.5
          text-[10.5px] font-semibold tracking-wide text-ink-50
          backdrop-blur
        "
      >
        #{item.id}
      </span>
    </Link>
  );
}
