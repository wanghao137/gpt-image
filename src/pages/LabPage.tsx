import { useCallback, useEffect, useRef, useState } from "react";
import { SEO } from "../components/SEO";
import { LabGrid } from "../components/LabGrid";
import { LAB_HOME, loadLabBrowsePage } from "../lib/data-lab";
import type { LabLiteRow } from "../types";

/**
 * 4K 实验室 index — masonry wall of every imported 4K original, newest first.
 * First 48 rows are inlined by SSG (LAB_HOME static import, ~10KB); further
 * pages auto-load via IntersectionObserver when the sentinel approaches the
 * viewport (600px rootMargin pre-loads before the user hits the bottom).
 * The button stays as a manual fallback / error retry path.
 */
export default function LabPage() {
  const [items, setItems] = useState<LabLiteRow[]>(LAB_HOME.items);
  // page 0 == LAB_HOME.items already rendered; next fetch is page 1.
  const [nextPage, setNextPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const hasMore = nextPage < LAB_HOME.pageCount;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const rows = await loadLabBrowsePage(nextPage);
      setItems((current) => {
        const seen = new Set(current.map((i) => i.id));
        return [...current, ...rows.filter((r) => !seen.has(r.id))];
      });
      setNextPage((p) => p + 1);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, nextPage]);

  // Auto-load (infinite scroll). Re-arms after every state change: when a
  // fetch finishes and the sentinel is STILL in view (short viewport / long
  // grid), the next page starts immediately. Guarded by hasMore/loading so
  // it never stacks requests. Client-only by construction (inside effect).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <>
      <SEO
        title={`4K 实验室 · ${LAB_HOME.totalCount} 张 GPT-Image 2 原生生图`}
        description="桃子AI视觉实验室的 GPT-Image 2 4K 原生生图档案：每张都附完整 Prompt、生成参数与 4K 原图下载，持续更新。"
        path="/lab"
      />

      <section className="container-narrow pb-2 pt-10 sm:pt-14">
        <p className="eyebrow">4K 实验室 · The Lab</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-[25px] font-semibold leading-tight tracking-[-0.02em] text-ink-50 sm:serif-display sm:text-4xl sm:font-normal lg:text-[44px]">
            4K 原生生图档案
          </h1>
          <p className="max-w-md text-[13px] leading-relaxed text-ink-400">
            每日生成的 GPT-Image 2 4K 原图，附完整 Prompt 与参数，可下载原图。
            共 {LAB_HOME.totalCount} 张，持续更新。
          </p>
        </div>
      </section>

      <section className="container-narrow pb-16">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-16 text-center">
            <p className="text-[15px] font-medium text-ink-200">实验室还在整理中</p>
            <p className="mt-2 text-[13px] text-ink-500">4K 生图即将上架，先去案例库逛逛。</p>
          </div>
        ) : (
          <>
            <LabGrid items={items} />

            {/* Infinite-scroll sentinel — enters viewport before the grid
                bottom and triggers the next shard fetch. Also the anchor
                for the manual button below. */}
            {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 text-[13px] font-medium text-ink-200 transition hover:border-white/25 hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "正在加载…"
                    : error
                      ? "加载失败，点此重试"
                      : `加载更多（${items.length}/${LAB_HOME.totalCount}）`}
                </button>
              </div>
            )}
            {!hasMore && items.length > LAB_HOME.pageSize && (
              <p className="mt-8 text-center text-[12px] text-ink-600">
                已展示全部 {LAB_HOME.totalCount} 张
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}
