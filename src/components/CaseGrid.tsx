import { useEffect, useMemo, useRef, useState } from "react";
import type { PromptCase } from "../types";
import { CaseCard } from "./CaseCard";

interface CaseGridProps {
  cases: PromptCase[];
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  loading?: boolean;
  onResetFilters?: () => void;
  /** Disable infinite scroll and render all at once. */
  paginate?: boolean;
  /**
   * Number of leading cards to mark as `priority` (eager + fetchPriority=high).
   * Use this for above-the-fold grids — e.g. the featured strip on the home
   * page renders 12 cards but only ~8 are visible without scrolling.
   */
  priorityCount?: number;
  /** Case id to scroll back to after returning from the detail page. */
  restoreId?: string | null;
  onRestored?: () => void;
  contained?: boolean;
}

const PAGE_SIZE = 24;

function getColumnCount() {
  if (typeof window === "undefined") return 1;
  if (window.matchMedia("(min-width: 1280px)").matches) return 4;
  if (window.matchMedia("(min-width: 1024px)").matches) return 3;
  if (window.matchMedia("(min-width: 640px)").matches) return 2;
  return 1;
}

function countForRestore(cases: PromptCase[], paginate: boolean, restoreId?: string | null) {
  if (!paginate) return cases.length;
  if (!restoreId) return PAGE_SIZE;
  const index = cases.findIndex((item) => item.id === restoreId);
  if (index < 0) return PAGE_SIZE;
  return Math.min(cases.length, Math.max(PAGE_SIZE, Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE));
}

function SkeletonCard() {
  return (
    <div className="mb-5 break-inside-avoid overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40">
      <div className="aspect-[4/5] animate-pulse bg-gradient-to-br from-ink-850 to-ink-800" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-ink-800" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-ink-800" />
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
  priorityCount = 0,
  restoreId,
  onRestored,
  contained = true,
}: CaseGridProps) {
  const [visibleCount, setVisibleCount] = useState(() =>
    countForRestore(cases, paginate, restoreId),
  );
  const [columnCount, setColumnCount] = useState(1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const restoredRef = useRef<string | null>(null);

  useEffect(() => {
    setVisibleCount(countForRestore(cases, paginate, restoreId));
  }, [cases, paginate, restoreId]);

  useEffect(() => {
    const updateColumnCount = () => {
      const next = getColumnCount();
      setColumnCount((current) => (current === next ? current : next));
    };
    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);

  useEffect(() => {
    if (!restoreId) restoredRef.current = null;
  }, [restoreId]);

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
  const columns = useMemo(() => {
    const next = Array.from({ length: columnCount }, () => [] as Array<{ item: PromptCase; index: number }>);
    visible.forEach((item, index) => {
      next[index % columnCount].push({ item, index });
    });
    return next;
  }, [columnCount, visible]);
  const wrapperClassName = contained ? "container-narrow pb-20" : "pb-20";

  useEffect(() => {
    if (!restoreId || restoredRef.current === restoreId) return;
    if (!visible.some((item) => item.id === restoreId)) return;

    let firstFrame = 0;
    let secondFrame = 0;
    let settleTimer = 0;
    let cancelled = false;
    const calibrationTimers: number[] = [];
    const userEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    const clearTimers = () => {
      calibrationTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(settleTimer);
    };
    const removeUserListeners = () => {
      userEvents.forEach((event) => window.removeEventListener(event, cancelCalibration));
    };
    const finish = () => {
      if (restoredRef.current === restoreId) return;
      restoredRef.current = restoreId;
      onRestored?.();
    };
    const cancelCalibration = () => {
      cancelled = true;
      clearTimers();
      removeUserListeners();
      finish();
    };
    const addUserListeners = () => {
      userEvents.forEach((event) => window.addEventListener(event, cancelCalibration, { passive: true }));
    };
    const scrollToTarget = () => {
      if (cancelled) return false;
      const el = document.getElementById(`case-${restoreId}`);
      if (!el) return false;
      el.scrollIntoView({ block: "center", behavior: "auto" });
      return true;
    };
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (scrollToTarget()) addUserListeners();
        [120, 350, 700, 1200, 1800, 2400].forEach((delay) => {
          calibrationTimers.push(window.setTimeout(scrollToTarget, delay));
        });
        settleTimer = window.setTimeout(() => {
          scrollToTarget();
          removeUserListeners();
          finish();
        }, 2600);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      clearTimers();
      removeUserListeners();
    };
  }, [onRestored, restoreId, visible]);

  if (loading) {
    return (
      <div className="container-narrow pb-24">
        <div className="masonry">
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
    <div className={wrapperClassName}>
      <div className="masonry">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="masonry-column">
            {column.map(({ item, index }) => (
              <CaseCard
                key={item.id}
                data={item}
                favorited={favoriteIds.has(item.id)}
                onToggleFavorite={onToggleFavorite}
                priority={index < priorityCount}
              />
            ))}
          </div>
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
