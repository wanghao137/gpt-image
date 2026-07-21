import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PromptCase } from "../types";
import { CaseCard } from "./CaseCard";
import { groupSeries } from "../lib/series";

interface CaseGridProps {
  cases: PromptCase[];
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  loading?: boolean;
  loadingMore?: boolean;
  hasMoreData?: boolean;
  onLoadMoreData?: () => void;
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
  restoreScrollY?: number | null;
  restoreTargetTop?: number | null;
  onRestored?: () => void;
  contained?: boolean;
}

const PAGE_SIZE = 24;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function countForRestore(cases: PromptCase[], paginate: boolean, restoreId?: string | null) {
  if (!paginate) return cases.length;
  if (!restoreId) return PAGE_SIZE;
  const index = cases.findIndex((item) => item.id === restoreId);
  if (index < 0) return PAGE_SIZE;
  return Math.min(cases.length, Math.max(PAGE_SIZE, Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE));
}

function SkeletonCard() {
  return (
    <div className="break-inside-avoid overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40">
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
  loadingMore = false,
  hasMoreData = false,
  onLoadMoreData,
  onResetFilters,
  paginate = true,
  priorityCount = 0,
  restoreId,
  restoreScrollY,
  restoreTargetTop,
  onRestored,
  contained = true,
}: CaseGridProps) {
  const [visibleCount, setVisibleCount] = useState(() =>
    countForRestore(cases, paginate, restoreId),
  );
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [restoreLayoutLocked, setRestoreLayoutLocked] = useState(false);
  const [restoreTargetLoaded, setRestoreTargetLoaded] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const masonryRef = useRef<HTMLDivElement | null>(null);
  const [masonryReady, setMasonryReady] = useState(false);
  const restoredRef = useRef<string | null>(null);
  const caseIds = useMemo(() => cases.map((item) => item.id), [cases]);
  const caseIdsKey = useMemo(() => caseIds.join("\u0000"), [caseIds]);
  const previousListRef = useRef({ caseIds, caseIdsKey, paginate });

  useEffect(() => {
    const listChanged =
      previousListRef.current.caseIdsKey !== caseIdsKey ||
      previousListRef.current.paginate !== paginate;
    const previous = previousListRef.current;
    const appendOnly =
      previous.paginate === paginate &&
      previous.caseIds.length <= caseIds.length &&
      previous.caseIds.every((id, index) => caseIds[index] === id);
    previousListRef.current = { caseIds, caseIdsKey, paginate };

    if (listChanged) {
      setVisibleCount((current) =>
        appendOnly
          ? Math.min(
              cases.length,
              Math.max(
                current >= previous.caseIds.length ? current + PAGE_SIZE : current,
                countForRestore(cases, paginate, restoreId),
              ),
            )
          : countForRestore(cases, paginate, restoreId),
      );
      if (!restoreId) setRestoreLayoutLocked(false);
      return;
    }

    if (restoreId) {
      setVisibleCount((current) => Math.max(current, countForRestore(cases, paginate, restoreId)));
    }
  }, [caseIds, caseIdsKey, cases, paginate, restoreId]);

  useEffect(() => {
    setRestoreTargetLoaded(false);
    if (restoreId) {
      setRestoreLayoutLocked(true);
    }
    if (!restoreId) {
      restoredRef.current = null;
      setRestoreInProgress(false);
    }
  }, [restoreId]);

  const handleRestoreTargetLoad = useCallback(() => {
    setRestoreTargetLoaded(true);
  }, []);

  const hasMore =
    paginate && (visibleCount < cases.length || hasMoreData) && !restoreId;
  // Load-more callback kept in a ref so the observer effect below can depend
  // only on `hasMore` (a boolean) rather than `visibleCount`, avoiding an
  // observer disconnect/reconnect on every pagination step.
  const loadMoreRef = useRef<() => void>(() => {});
  loadMoreRef.current = () => {
    if (visibleCount < cases.length) {
      setVisibleCount((count) => Math.min(count + PAGE_SIZE, cases.length));
      return;
    }
    if (hasMoreData && !loadingMore) onLoadMoreData?.();
  };

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    let frame = 0;
    const checkDistance = () => {
      frame = 0;
      if (el.getBoundingClientRect().top <= window.innerHeight + 600) {
        loadMoreRef.current();
      }
    };
    const scheduleCheck = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(checkDistance);
    };
    window.addEventListener("scroll", scheduleCheck, { passive: true });
    window.addEventListener("resize", scheduleCheck, { passive: true });
    scheduleCheck();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleCheck);
      window.removeEventListener("resize", scheduleCheck);
    };
  }, [hasMore]);

  const visible = useMemo(() => cases.slice(0, visibleCount), [cases, visibleCount]);
  // Collapse same-series cases into one carousel card. Grouping happens on the
  // already-paginated `visible` slice so the "load more" count reflects what
  // the user actually sees (siblings count toward the page even though they
  // render inside the lead card).
  const { leads, siblingsByLeadId } = useMemo(() => groupSeries(visible), [visible]);
  // Reverse lookup: sibling id → lead id, so scroll-restore from a sibling's
  // detail page still resolves to the lead card's DOM anchor.
  const leadIdByCaseId = useMemo(() => {
    const map = new Map<string, string>();
    for (const [leadId, sibs] of siblingsByLeadId) {
      map.set(leadId, leadId);
      for (const s of sibs) map.set(s.id, leadId);
    }
    return map;
  }, [siblingsByLeadId]);
  const restoreLeadId = restoreId
    ? leadIdByCaseId.get(restoreId) ?? leads.find((l) => l.id === restoreId)?.id ?? null
    : null;

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
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
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
  }, [visible]);
  // Stable boolean: is the scroll-restore target currently rendered? Depending
  // on this instead of the `visible` array keeps the restore effect from
  // tearing down and rebuilding its rAF + timer machinery on every
  // "load more" pagination step.
  const restoreTargetVisible = useMemo(
    () => (restoreId ? visible.some((item) => item.id === restoreId) : false),
    [restoreId, visible],
  );
  const baseWrapperClassName = contained ? "container-narrow pb-20" : "pb-20";
  const wrapperClassName = restoreInProgress || restoreLayoutLocked
    ? `${baseWrapperClassName} case-grid-restoring`
    : baseWrapperClassName;

  useEffect(() => {
    if (typeof document === "undefined" || !restoreInProgress) return;
    document.body.classList.add("case-return-restoring");
    return () => document.body.classList.remove("case-return-restoring");
  }, [restoreInProgress]);

  useEffect(() => {
    if (!restoreId || restoredRef.current === restoreId) return;
    if (!restoreTargetVisible) return;

    setRestoreInProgress(true);
    let firstFrame = 0;
    let secondFrame = 0;
    let settleTimer = 0;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const calibrationTimers: number[] = [];
    const userEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    const clearTimers = () => {
      calibrationTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(settleTimer);
    };
    const disconnectResizeObserver = () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
    };
    const removeUserListeners = () => {
      userEvents.forEach((event) => window.removeEventListener(event, cancelCalibration));
    };
    const finish = () => {
      if (restoredRef.current === restoreId) return;
      restoredRef.current = restoreId;
      setRestoreInProgress(false);
      onRestored?.();
    };
    const cancelCalibration = () => {
      cancelled = true;
      clearTimers();
      disconnectResizeObserver();
      removeUserListeners();
      finish();
    };
    const addUserListeners = () => {
      userEvents.forEach((event) => window.addEventListener(event, cancelCalibration, { passive: true }));
    };
    const scrollToTarget = () => {
      if (cancelled) return false;
      // Sibling cards don't have their own DOM id — scroll to the lead's
      // anchor (the whole carousel card lives at the lead position).
      const anchorId = restoreLeadId ?? restoreId;
      const el = anchorId ? document.getElementById(`case-${anchorId}`) : null;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const maxScrollY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const targetScrollY =
        typeof restoreTargetTop === "number"
          ? window.scrollY + rect.top - restoreTargetTop
          : typeof restoreScrollY === "number"
            ? restoreScrollY
            : null;
      if (targetScrollY !== null && Number.isFinite(targetScrollY)) {
        window.scrollTo({
          top: Math.max(0, Math.min(maxScrollY, targetScrollY)),
          behavior: "instant" as ScrollBehavior,
        });
      } else {
        el.scrollIntoView({ block: "center", behavior: "auto" });
      }
      return true;
    };
    const watchTargetSize = () => {
      if (resizeObserver || typeof ResizeObserver === "undefined") return;
      const el = document.getElementById(`case-${restoreId}`);
      if (!el) return;
      resizeObserver = new ResizeObserver(() => {
        scrollToTarget();
      });
      resizeObserver.observe(el);
    };
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (scrollToTarget()) {
          addUserListeners();
          watchTargetSize();
        }
        [120, 350, 700, 1200, 1800, 2400].forEach((delay) => {
          calibrationTimers.push(window.setTimeout(scrollToTarget, delay));
        });
        settleTimer = window.setTimeout(() => {
          scrollToTarget();
          disconnectResizeObserver();
          removeUserListeners();
          finish();
        }, restoreTargetLoaded ? 1800 : 3000);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      clearTimers();
      disconnectResizeObserver();
      removeUserListeners();
    };
  }, [onRestored, restoreId, restoreLeadId, restoreScrollY, restoreTargetLoaded, restoreTargetTop, restoreTargetVisible]);

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

  const remaining = Math.max(0, cases.length - visibleCount);
  const canLoadMore = remaining > 0 || hasMoreData;

  return (
    <div className={wrapperClassName}>
      <div
        ref={masonryRef}
        className={`masonry masonry-feed${masonryReady ? " masonry-ready" : ""}`}
      >
        {leads.map((item, index) => {
          // Restore target hits when either the lead or any sibling matches
          // restoreId — they all live in the same DOM card.
          const siblings = siblingsByLeadId.get(item.id);
          const isRestoreTarget =
            restoreId === item.id || (siblings?.some((s) => s.id === restoreId) ?? false);
          return (
            <div className="masonry-item" key={item.id}>
              <CaseCard
                data={item}
                siblings={siblings}
                favorited={favoriteIds.has(item.id)}
                favoritedIds={favoriteIds}
                onToggleFavorite={onToggleFavorite}
                priority={index < priorityCount}
                onImageLoad={isRestoreTarget ? handleRestoreTargetLoad : undefined}
              />
            </div>
          );
        })}
      </div>

      {paginate && canLoadMore && (
        <div
          ref={sentinelRef}
          className="mt-8 flex flex-col items-center justify-center gap-3"
          aria-live="polite"
          aria-atomic="true"
        >
          <button
            type="button"
            onClick={loadMoreRef.current}
            disabled={loadingMore}
            className="btn-ghost"
          >
            {loadingMore ? "正在加载更多案例…" : "加载更多"}
            {remaining > 0 && <span className="text-ink-400">· 还剩 {remaining}</span>}
          </button>
        </div>
      )}

      {paginate && !canLoadMore && cases.length > PAGE_SIZE && (
        <p className="mt-10 text-center text-xs text-ink-500">已显示全部 {cases.length} 个案例</p>
      )}
    </div>
  );
}
