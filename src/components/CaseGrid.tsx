import { useEffect, useMemo, useRef, useState } from "react";
import type { PromptCase } from "../types";
import { CaseCard } from "./CaseCard";

interface CaseGridProps {
  cases: PromptCase[];
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  loading?: boolean;
  onResetFilters?: () => void;
  /** Disable infinite scroll and render all at once. Useful on category pages. */
  paginate?: boolean;
}

const PAGE_SIZE = 24;

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40">
      <div className="aspect-[4/5] animate-pulse bg-gradient-to-br from-ink-850 to-ink-800" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-ink-800" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-ink-800" />
        <div className="h-3 w-full animate-pulse rounded bg-ink-800" />
        <div className="h-9 w-full animate-pulse rounded-xl bg-ink-800" />
      </div>
    </div>
  );
}

export function CaseGrid({
  cases,
  favoriteIds,
  onToggleFavorite,
  loading,
  onResetFilters,
  paginate = true,
}: CaseGridProps) {
  const [visibleCount, setVisibleCount] = useState(paginate ? PAGE_SIZE : cases.length);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // reset pagination when result set changes
  useEffect(() => {
    setVisibleCount(paginate ? PAGE_SIZE : cases.length);
  }, [cases, paginate]);

  useEffect(() => {
    if (!paginate) return;
    const el = sentinelRef.current;
    if (!el) return;
    if (visibleCount >= cases.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, cases.length));
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cases.length, visibleCount, paginate]);

  const visible = useMemo(() => cases.slice(0, visibleCount), [cases, visibleCount]);

  if (loading) {
    return (
      <div className="container-narrow pb-24">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="container-narrow pb-24">
        <div className="surface mx-auto max-w-xl p-10 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-ink-300">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-base font-medium text-ink-50">没有找到匹配的案例</p>
          <p className="mt-1.5 text-sm text-ink-400">试试别的关键词，或者重置筛选条件。</p>
          {onResetFilters && (
            <button type="button" onClick={onResetFilters} className="btn-ghost mt-5">
              清除筛选
            </button>
          )}
        </div>
      </div>
    );
  }

  const remaining = cases.length - visibleCount;

  return (
    <div className="container-narrow pb-20">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((item) => (
          <CaseCard
            key={item.id}
            data={item}
            favorited={favoriteIds.has(item.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {paginate && remaining > 0 && (
        <div ref={sentinelRef} className="mt-8 flex flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, cases.length))}
            className="btn-ghost"
          >
            加载更多
            <span className="text-ink-400">· 还剩 {remaining}</span>
          </button>
        </div>
      )}

      {paginate && remaining === 0 && cases.length > PAGE_SIZE && (
        <p className="mt-10 text-center text-xs text-ink-500">已显示全部 {cases.length} 个案例</p>
      )}
    </div>
  );
}
