import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PromptTemplate } from "../types";
import { TemplateCard } from "./TemplateCard";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Masonry wall of template cards (`.masonry-dense` ladder: 2/3/4/5/6/7 cols).
 *
 * Same row-first 1px-grid technique /cases and /lab solved their ordering bugs
 * with (2026-09-03 "排序乱了"): JS measures each card and sets
 * `grid-row-end: span N`, so DOM order == visual reading order and appended
 * items never reshuffle existing ones. Covers render at natural aspect ratio,
 * which is exactly why a wall (not a uniform grid) is the right container —
 * portrait posters get full-height cards instead of being cropped to a sliver.
 */
export function TemplateGrid({ templates }: { templates: PromptTemplate[] }) {
  const masonryRef = useRef<HTMLDivElement | null>(null);
  const [masonryReady, setMasonryReady] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const grid = masonryRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 16;
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
  }, [templates]);

  return (
    <div ref={masonryRef} className={`masonry masonry-dense${masonryReady ? " masonry-ready" : ""}`}>
      {templates.map((t) => (
        <div className="masonry-item" key={t.id}>
          <TemplateCard data={t} />
        </div>
      ))}
    </div>
  );
}
