import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { PromptCase } from "../types";
import { optimizeImage } from "../lib/img";
import { HOMEPAGE_USER_CATEGORIES } from "../lib/userCategories";

interface CategoryShowcaseProps {
  cases: PromptCase[];
}

interface TileData {
  slug: string;
  label: string;
  tagline: string;
  count: number;
  cover?: string;
}

/**
 * Homepage tile grid showing 12 user-intent buckets, each linking to its
 * own /category/:slug page. Counts and covers are derived from the actual
 * dataset so empty buckets disappear gracefully.
 *
 * Mobile / desktop have different layouts:
 *   - Mobile (<sm): horizontal list rows — thumbnail left, label + tagline +
 *     count right. Reads like a Xiaohongshu / Apple Music browse list:
 *     much higher scan-ability than a 2-col tile grid where the per-tile
 *     overlay text is fighting low-res cover images.
 *   - sm+: 3-/4-col tile grid with full-bleed cover images, the original
 *     editorial design.
 */
export function CategoryShowcase({ cases }: CategoryShowcaseProps) {
  const tiles = useMemo<TileData[]>(() => {
    const byKey = new Map<string, PromptCase[]>();
    for (const c of cases) {
      const arr = byKey.get(c.userCategory);
      if (arr) arr.push(c);
      else byKey.set(c.userCategory, [c]);
    }
    return HOMEPAGE_USER_CATEGORIES.map((meta) => {
      const list = byKey.get(meta.key) ?? [];
      return {
        slug: meta.slug,
        label: meta.label,
        tagline: meta.tagline,
        count: list.length,
        cover: list[0]?.imageUrl,
      };
    }).filter((tile) => tile.count > 0);
  }, [cases]);

  if (tiles.length === 0) return null;

  return (
    <section aria-label="按场景浏览" className="container-narrow pt-10 sm:pt-14">
      <div className="mb-5 flex flex-col gap-1 sm:mb-6">
        <p className="eyebrow">Browse by Use Case · 按场景浏览</p>
        <h2 className="serif-display text-[24px] text-ink-50 sm:text-4xl lg:text-[42px]">
          从一个场景开始，复制就能出图。
        </h2>
        <p className="mt-1 hidden text-[14px] text-ink-400 sm:block sm:text-[15px]">
          按真实使用场景重新分类，找最常用的 GPT-Image 2 案例和 Prompt。
        </p>
      </div>

      {/* Mobile: list rows — easier to scan, thumb gives at-a-glance preview */}
      <ul className="flex flex-col divide-y divide-white/[0.04] overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015] sm:hidden">
        {tiles.map((tile) => (
          <li key={tile.slug}>
            <Link
              to={`/category/${tile.slug}`}
              className="flex items-center gap-3.5 px-3.5 py-3 transition active:bg-white/[0.04]"
            >
              <span
                className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-ink-850"
                aria-hidden="true"
              >
                {tile.cover && (
                  <img
                    src={optimizeImage(tile.cover, { width: 168 })}
                    alt=""
                    width={56}
                    height={56}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <strong className="truncate text-[15px] font-semibold text-ink-50">
                    {tile.label}
                  </strong>
                  <span className="shrink-0 rounded-full border border-white/10 bg-ink-950/60 px-1.5 py-0.5 text-[10.5px] tabular-nums text-ink-300">
                    {tile.count}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[12px] leading-snug text-ink-400">
                  {tile.tagline}
                </p>
              </div>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 shrink-0 text-ink-500"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          </li>
        ))}
      </ul>

      {/* sm+: original editorial tile grid */}
      <div className="hidden grid-cols-3 gap-3 sm:grid lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.slug}
            to={`/category/${tile.slug}`}
            className="group relative h-32 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] text-left transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.16] hover:shadow-soft sm:h-36"
          >
            {tile.cover && (
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-30 transition duration-700 group-hover:scale-105 group-hover:opacity-55"
                style={{
                  backgroundImage: `url(${optimizeImage(tile.cover, { width: 480 })})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/75 to-ink-950/30" />
            <div className="relative flex h-full flex-col justify-end p-4">
              <div className="flex items-center justify-between">
                <strong className="block truncate text-[14px] font-semibold text-ink-50">
                  {tile.label}
                </strong>
                <span className="rounded-full border border-white/10 bg-ink-950/60 px-1.5 py-0.5 text-[10.5px] tabular-nums text-ink-300">
                  {tile.count}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-ink-400">
                {tile.tagline}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-5 text-right sm:mt-6">
        <Link
          to="/cases"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ember-300 transition hover:text-ember-200"
        >
          查看全部 {cases.length} 个案例
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
      </div>
    </section>
  );
}
