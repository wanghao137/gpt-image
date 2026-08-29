import { Link } from "react-router-dom";
import type { LabLiteRow } from "../types";
import { SmartImg } from "./SmartImg";

function labDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Masonry wall of 4K lab originals. CSS columns (not grid) so cards keep
 * their natural aspect ratio and flow into the shortest column — the archive
 * mixes 3:4 / 9:16 / 1:1 / 4:3, and a uniform grid would either crop or leave
 * dead space. `break-inside-avoid` + `aspect-ratio` placeholder keep CLS at 0.
 */
export function LabGrid({ items }: { items: LabLiteRow[] }) {
  return (
    <div className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
      {items.map((item) => (
        <Link
          key={item.id}
          to={`/lab/${item.slug}`}
          className="group mb-3 block break-inside-avoid rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5 transition hover:border-ember-400/40 hover:bg-white/[0.05] sm:mb-4"
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
          <div className="flex items-baseline justify-between gap-2 px-1.5 pb-0.5 pt-1.5">
            <span className="min-w-0 truncate text-[12.5px] font-medium text-ink-200 group-hover:text-ink-50">
              {item.t}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-ink-500">
              {labDate(item.d)}
            </span>
          </div>
          <div className="px-1.5 pb-1 text-[10.5px] tracking-wide text-ink-600">
            {item.w}×{item.h} · 4K
          </div>
        </Link>
      ))}
    </div>
  );
}
