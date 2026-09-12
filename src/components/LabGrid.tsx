import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { LabLiteRow } from "../types";
import { SmartImg } from "./SmartImg";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function LabCard({ item }: { item: LabLiteRow }) {
  return (
    <Link
      to={`/lab/${item.slug}`}
      className="group block break-inside-avoid rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5 transition hover:border-ember-400/40 hover:bg-white/[0.05]"
    >
      <div
        className="overflow-hidden rounded-lg bg-ink-900/60"
        style={{ aspectRatio: `${Math.max(item.w, 1)} / ${Math.max(item.h, 1)}` }}
      >
        {/* Decorative alt: the link's accessible name comes from the visible
            title/date/dims text below — a duplicated alt made screen readers
            announce the title twice (found in adversarial review). */}
        <SmartImg
          src={item.thumb}
          alt=""
          width={item.w}
          height={item.h}
          preserveAspectRatio
          className="h-full w-full transition duration-300 group-hover:scale-[1.02]"
        />
      </div>
      <div className="px-1 pb-1 pt-1">
        {/* 极简: title only — date/dimensions live on the detail page. The
            title owns a full line (the wall is 2-up on phones). */}
        <div className="truncate text-[12px] font-medium text-ink-200 group-hover:text-ink-50">
          {item.t}
        </div>
      </div>
    </Link>
  );
}

/**
 * Masonry wall of 4K lab originals, newest first.
 *
 * Layout: the SAME row-first technique /cases solved its ordering bug with
 * (2026-09-03 "排序乱了" report): a 1px-row CSS grid where JS measures each
 * card and sets `grid-row-end: span N`. Row-first means DOM order == visual
 * reading order, so appended pages never reshuffle existing cards — the old
 * CSS multi-column implementation rebalanced every column on each load-more
 * step and visually scrambled the timeline. Reuses the global `.masonry` CSS
 * (column skeleton until first measure, grid afterwards).
 */
export function LabGrid({ items }: { items: LabLiteRow[] }) {
  const masonryRef = useRef<HTMLDivElement | null>(null);
  const [masonryReady, setMasonryReady] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const grid = masonryRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 20;
      grid.querySelectorAll<HTMLElement>(".masonry-item").forEach((item) => {
        const card = item.firstElementChild as HTMLElement | null;
        if (!card) return;
        const height = card.getBoundingClientRect().height;
        const span = Math.ceil(height + gap);
        item.style.gridRowEnd = `span ${Math.max(1, span)}`;
      });
      setMasonryReady(true);
    };
    const scheduleMeasure = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(scheduleMeasure);
    grid.querySelectorAll<HTMLElement>(".masonry-item > *").forEach((card) => {
      observer.observe(card);
    });
    measure();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [items]);

  return (
    // `masonry-dense` (not the shared `masonry-feed` marker) carries the wall's
    // column ladder: CaseGrid renders `masonry masonry-feed` too, and its cards
    // pin a text overlay onto the image, so the shared class must never flip
    // cases to the dense ladder.
    <div
      ref={masonryRef}
      className={`masonry masonry-feed masonry-dense${masonryReady ? " masonry-ready" : ""}`}
    >
      {items.map((item) => (
        <div className="masonry-item" key={item.id}>
          <LabCard item={item} />
        </div>
      ))}
    </div>
  );
}
