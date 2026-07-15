import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ALL_CASES, loadShard } from "../lib/data";
import type { PromptCase } from "../types";
import { CaseGrid } from "../components/CaseGrid";
import { FilterBar } from "../components/FilterBar";
import { SEO } from "../components/SEO";
import { BRAND } from "../lib/brand";
import { useFavorites } from "../hooks/useFavorites";
import { useCaseReturnRestore } from "../hooks/useCaseReturnRestore";
import { useSearchData } from "../hooks/useSearchIndex";
import { HOME_DATA } from "../hooks/useHomeData";

function readSet(sp: URLSearchParams, key: string): Set<string> {
  const raw = sp.get(key);
  if (!raw) return new Set();
  return new Set(raw.split(",").filter(Boolean));
}

function writeSet(sp: URLSearchParams, key: string, set: Set<string>) {
  if (set.size === 0) sp.delete(key);
  else sp.set(key, Array.from(set).join(","));
}

/**
 * Full case library. Filter / search / favorite state is mirrored to the URL.
 *
 * SSG: pre-rendered with ALL_CASES (server has the full dataset). The initial
 * HTML shows the featured cases from cases-home.json.
 *
 * Client hydration: loads the search index (cases-search.json) for search.
 * Category filter → loads the relevant shard. Style/scene/platform filter →
 * searches across the index, then loads shards containing matches.
 */
export default function CasesPage() {
  const [sp, setSp] = useSearchParams();
  const { ids: favoriteIds, toggle } = useFavorites();

  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(() => new Set());
  const [activeStyles, setActiveStyles] = useState<Set<string>>(() => new Set());
  const [activeScenes, setActiveScenes] = useState<Set<string>>(() => new Set());
  const [activePlatforms, setActivePlatforms] = useState<Set<string>>(() => new Set());
  const [showFavorites, setShowFavorites] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { restoreId, restoreTarget, onRestored } = useCaseReturnRestore();
  const lastWrittenSearch = useRef<string | null>(null);

  // Load search index + filter options on the client.
  const { filterOptions } = useSearchData();

  // URL → state sync.
  useEffect(() => {
    const current = sp.toString();
    if (current === lastWrittenSearch.current) return;
    setQuery(sp.get("q") ?? "");
    setActiveCategories(readSet(sp, "cat"));
    setActiveStyles(readSet(sp, "style"));
    setActiveScenes(readSet(sp, "scene"));
    setActivePlatforms(readSet(sp, "platform"));
    setHydrated(true);
  }, [sp]);

  // State → URL sync.
  useEffect(() => {
    if (!hydrated) return;
    const next = new URLSearchParams(sp);
    if (query) next.set("q", query);
    else next.delete("q");
    writeSet(next, "cat", activeCategories);
    writeSet(next, "style", activeStyles);
    writeSet(next, "scene", activeScenes);
    writeSet(next, "platform", activePlatforms);
    if (next.toString() !== sp.toString()) {
      lastWrittenSearch.current = next.toString();
      setSp(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, query, activeCategories, activeStyles, activeScenes, activePlatforms]);

  const styleOptions = filterOptions?.styles ?? [];
  const sceneOptions = filterOptions?.scenes ?? [];

  // ── Case data loading ──
  // SSG mode: use ALL_CASES directly.
  // Client mode: load shards based on active filters.
  const isSSR = import.meta.env.SSR;

  // Determine which categories we need to load.
  const neededCategories = useMemo(() => {
    if (isSSR) return new Set<string>();
    if (activeCategories.size > 0) return activeCategories;
    // No category filter: we need all categories (or at least the first few
    // for the default view). For the "browse all" experience, load shards
    // incrementally starting from the largest categories.
    return null; // null = "all"
  }, [activeCategories, isSSR]);

  // Client-side shard state.
  const [shardCases, setShardCases] = useState<PromptCase[]>([]);
  const [shardsLoading, setShardsLoading] = useState(!isSSR);

  useEffect(() => {
    if (isSSR) return;

    // If a category filter is active, load those shards.
    if (neededCategories) {
      let cancelled = false;
      setShardsLoading(true);
      Promise.all(Array.from(neededCategories).map((cat) => loadShard(cat)))
        .then((results) => {
          if (!cancelled) {
            setShardCases(results.flat());
            setShardsLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setShardsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    // No category filter: load shards incrementally (portrait first, then
    // others) for the "browse all" default view. Start with the top categories.
    let cancelled = false;
    setShardsLoading(true);
    const priorityCats = ["portrait", "poster-general", "illustration", "storyboard", "infographic"];
    Promise.all(priorityCats.map((cat) => loadShard(cat)))
      .then((results) => {
        if (!cancelled) {
          setShardCases(results.flat());
          setShardsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setShardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [neededCategories, isSSR]);

  // The base case list for rendering.
  const baseList = useMemo<PromptCase[]>(() => {
    if (isSSR) return ALL_CASES as unknown as PromptCase[];
    if (showFavorites) return shardCases.filter((c) => favoriteIds.has(c.id));
    return shardCases;
  }, [isSSR, shardCases, showFavorites, favoriteIds]);

  // Build search index from the loaded shard data (client-side).
  const searchBlobMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of baseList) {
      map.set(
        c.id,
        [c.id, c.title, c.category, c.promptPreview, c.source, ...(c.tags ?? []), ...(c.styles ?? []), ...(c.scenes ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      );
    }
    return map;
  }, [baseList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseList.filter((c) => {
      if (activeCategories.size > 0) {
        const all = new Set([c.userCategory, ...(c.userCategories ?? [])]);
        let any = false;
        for (const k of activeCategories) {
          if (all.has(k as never)) {
            any = true;
            break;
          }
        }
        if (!any) return false;
      }
      if (activeStyles.size > 0) {
        if (!(c.styles ?? []).some((s) => activeStyles.has(s))) return false;
      }
      if (activeScenes.size > 0) {
        if (!(c.scenes ?? []).some((s) => activeScenes.has(s))) return false;
      }
      if (activePlatforms.size > 0) {
        if (!(c.platforms ?? []).some((p) => activePlatforms.has(p))) return false;
      }
      if (!q) return true;
      return (searchBlobMap.get(c.id) ?? "").includes(q);
    });
  }, [baseList, activeCategories, activeStyles, activeScenes, activePlatforms, query, searchBlobMap]);

  const hasActiveFilter =
    query.trim().length > 0 ||
    activeCategories.size > 0 ||
    activeStyles.size > 0 ||
    activeScenes.size > 0 ||
    activePlatforms.size > 0;

  const resetFilters = useCallback(() => {
    setQuery("");
    setActiveCategories(new Set());
    setActiveStyles(new Set());
    setActiveScenes(new Set());
    setActivePlatforms(new Set());
  }, []);

  const favoriteCount = favoriteIds.size;
  const totalCount = isSSR ? (ALL_CASES as unknown as { length: number }).length : HOME_DATA.totalCount;

  return (
    <>
      <SEO
        title={`全部案例 · ${totalCount}+ GPT-Image 2 真实案例`}
        description={`${BRAND.name}按用例、风格、场景、平台筛选 GPT-Image 2 真实案例。一键复制 Prompt，免费用作灵感来源。`}
        path="/cases"
      />

      <section className="container-narrow pb-2 pt-10 sm:pt-14">
        <p className="eyebrow">All Cases</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-[25px] font-semibold leading-tight tracking-[-0.02em] text-ink-50 sm:serif-display sm:text-4xl sm:font-normal lg:text-[44px]">
            按场景筛选 {totalCount} 个 GPT-Image 2 案例
          </h1>
          <button
            type="button"
            onClick={() => setShowFavorites((v) => !v)}
            disabled={favoriteCount === 0}
            className={
              "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 " +
              (showFavorites
                ? "border-ember-500/50 bg-ember-500/15 text-ember-100"
                : "border-white/10 bg-white/[0.03] text-ink-200 hover:border-white/25 hover:text-ink-50")
            }
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill={showFavorites ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
            </svg>
            我的收藏
            {favoriteCount > 0 && (
              <span className="rounded-full bg-ink-950/40 px-1.5 py-0.5 text-[10.5px] tabular-nums">
                {favoriteCount}
              </span>
            )}
          </button>
        </div>
      </section>

      <FilterBar
        query={query}
        onQueryChange={setQuery}
        activeCategories={activeCategories}
        onCategoriesChange={setActiveCategories}
        styles={styleOptions}
        activeStyles={activeStyles}
        onStylesChange={setActiveStyles}
        scenes={sceneOptions}
        activeScenes={activeScenes}
        onScenesChange={setActiveScenes}
        activePlatforms={activePlatforms}
        onPlatformsChange={setActivePlatforms}
        total={baseList.length}
        matched={filtered.length}
        hasActiveFilter={hasActiveFilter}
        onReset={resetFilters}
      />

      <CaseGrid
        cases={filtered}
        favoriteIds={favoriteIds}
        onToggleFavorite={toggle}
        onResetFilters={resetFilters}
        priorityCount={4}
        restoreId={restoreId}
        restoreScrollY={restoreTarget?.scrollY}
        restoreTargetTop={restoreTarget?.targetTop}
        onRestored={onRestored}
        loading={shardsLoading}
      />
    </>
  );
}
