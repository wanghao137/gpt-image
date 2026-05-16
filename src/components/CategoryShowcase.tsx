import { useMemo } from "react";
import type { PromptCase } from "../types";
import { optimizeImage } from "../lib/img";

interface CategoryShowcaseProps {
  cases: PromptCase[];
  activeCategory: string;
  onCategoryChange: (c: string) => void;
}

const ALL = "全部";

interface CategoryStat {
  name: string;
  count: number;
  cover?: string;
}

export function CategoryShowcase({
  cases,
  activeCategory,
  onCategoryChange,
}: CategoryShowcaseProps) {
  const categories = useMemo<CategoryStat[]>(() => {
    const map = new Map<string, CategoryStat>();
    for (const c of cases) {
      const existing = map.get(c.category);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(c.category, { name: c.category, count: 1, cover: c.imageUrl });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [cases]);

  if (categories.length === 0) return null;

  return (
    <section aria-label="categories" className="relative">
      <div className="container-narrow pb-2 pt-6">
        <div className="mb-6 flex flex-col gap-1">
          <p className="eyebrow">Browse by Category</p>
          <h2 className="serif-display text-2xl text-ink-50 sm:text-[28px]">
            {categories.length} 个分类，按热度排序
          </h2>
        </div>
      </div>

      <div className="container-narrow pb-6">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <button
            type="button"
            onClick={() => {
              onCategoryChange(ALL);
              document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
            }}
            className={
              "group relative flex h-24 flex-col items-start justify-between overflow-hidden rounded-xl border p-3 text-left transition duration-300 " +
              (activeCategory === ALL
                ? "border-ember-500/50 bg-ember-500/10"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04]")
            }
          >
            <span className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-400">
              All
            </span>
            <div>
              <strong className="block text-[13px] font-semibold text-ink-50">
                全部案例
              </strong>
              <span className="mt-0.5 block text-[11px] tabular-nums text-ink-500">
                {cases.length} 个
              </span>
            </div>
          </button>

          {categories.slice(0, 11).map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => {
                  onCategoryChange(cat.name);
                  document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={
                  "group relative h-24 overflow-hidden rounded-xl border text-left transition duration-300 " +
                  (isActive
                    ? "border-ember-500/50 bg-ember-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:-translate-y-0.5 hover:border-white/[0.16]")
                }
              >
                {cat.cover && (
                  <div
                    className="absolute inset-0 opacity-30 transition duration-500 group-hover:opacity-50 group-hover:scale-105"
                    style={{
                      backgroundImage: `url(${optimizeImage(cat.cover, { width: 320 })})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/30" />
                <div className="relative flex h-full flex-col justify-end p-3">
                  <strong className="block truncate text-[13px] font-semibold text-ink-50">
                    {cat.name}
                  </strong>
                  <span className="mt-0.5 block text-[11px] tabular-nums text-ink-400">
                    {cat.count} 个
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
