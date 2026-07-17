import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ALL_CASES, getCachedShard, loadShard } from "../lib/data";
import type { PromptCase } from "../types";
import { CaseGrid } from "../components/CaseGrid";
import { FilterBar } from "../components/FilterBar";
import { SEO } from "../components/SEO";
import { BRAND } from "../lib/brand";
import { useFavorites } from "../hooks/useFavorites";
import { useCaseReturnRestore } from "../hooks/useCaseReturnRestore";
import { useFilterOptions, useSearchIndex } from "../hooks/useSearchIndex";
import { HOME_DATA } from "../hooks/useHomeData";
import { USER_CATEGORIES } from "../lib/userCategories";
import { sortCasesForDisplay } from "../lib/caseSort";
import {
  categoriesForSearchEntries,
  filterCaseSearchEntries,
} from "../lib/case-search-core.mjs";

const BROWSE_BATCH_SIZE = 1;
const BROWSE_PRIORITY = [
  "xhs-cover",
  "merchant-poster",
  "ecommerce",
  "portrait",
  "brand-kv",
  "poster-general",
];
const BROWSE_CATEGORY_ORDER = [
  ...BROWSE_PRIORITY,
  ...USER_CATEGORIES.map((category) => category.slug).filter(
    (category) => !BROWSE_PRIORITY.includes(category),
  ),
];

function uniqueCases(cases: PromptCase[]): PromptCase[] {
  const seen = new Set<string>();
  return cases.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function cachedBrowseCases(): { cases: PromptCase[]; categories: Set<string> } {
  const categories = new Set<string>();
  const cases = [...HOME_DATA.initial];
  for (const category of BROWSE_CATEGORY_ORDER) {
    const cached = getCachedShard(category);
    if (!cached) continue;
    categories.add(category);
    cases.push(...cached);
  }
  return { cases: uniqueCases(cases), categories };
}

function readSet(sp: URLSearchParams, key: string): Set<string> {
  const raw = sp.get(key);
  if (!raw) return new Set();
  return new Set(raw.split(",").filter(Boolean));
}

function writeSet(sp: URLSearchParams, key: string, set: Set<string>) {
  if (set.size === 0) sp.delete(key);
  else sp.set(key, Array.from(set).join(","));
}

export default function CasesPage() {
  const [sp, setSp] = useSearchParams();
  const { ids: favoriteIds, toggle } = useFavorites();
  const isSSR = import.meta.env.SSR;

  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(() => new Set());
  const [activeStyles, setActiveStyles] = useState<Set<string>>(() => new Set());
  const [activeScenes, setActiveScenes] = useState<Set<string>>(() => new Set());
  const [activePlatforms, setActivePlatforms] = useState<Set<string>>(() => new Set());
  const [showFavorites, setShowFavorites] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { restoreId, restoreTarget, onRestored } = useCaseReturnRestore();
  const lastWrittenSearch = useRef<string | null>(null);

  const initialBrowse = useRef<ReturnType<typeof cachedBrowseCases> | null>(null);
  if (!initialBrowse.current) initialBrowse.current = cachedBrowseCases();

  const [shardCases, setShardCases] = useState<PromptCase[]>(() =>
    isSSR ? [] : initialBrowse.current!.cases,
  );
  const [browseLoadedCategories, setBrowseLoadedCategories] = useState<Set<string>>(
    () => (isSSR ? new Set() : initialBrowse.current!.categories),
  );
  const [browseLoading, setBrowseLoading] = useState(false);
  const [filteredLoading, setFilteredLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const browseLoadingRef = useRef(false);

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

  const hasActiveFilter =
    query.trim().length > 0 ||
    activeCategories.size > 0 ||
    activeStyles.size > 0 ||
    activeScenes.size > 0 ||
    activePlatforms.size > 0;
  const needsSearchIndex =
    query.trim().length > 0 ||
    activeStyles.size > 0 ||
    activeScenes.size > 0 ||
    activePlatforms.size > 0 ||
    showFavorites;
  const browseMode = !hasActiveFilter && !showFavorites;

  const { data: filterOptions } = useFilterOptions();
  const {
    data: searchIndex,
    loading: searchLoading,
    error: searchError,
    retry: retrySearch,
  } = useSearchIndex(needsSearchIndex);

  const matchingEntries = useMemo(() => {
    if (!needsSearchIndex || !searchIndex) return [];
    return filterCaseSearchEntries(searchIndex, {
      query,
      categories: activeCategories,
      styles: activeStyles,
      scenes: activeScenes,
      platforms: activePlatforms,
      favoriteIds: showFavorites ? favoriteIds : null,
    });
  }, [
    activeCategories,
    activePlatforms,
    activeScenes,
    activeStyles,
    favoriteIds,
    needsSearchIndex,
    query,
    searchIndex,
    showFavorites,
  ]);

  const matchingIds = useMemo(
    () =>
      needsSearchIndex && searchIndex
        ? new Set(matchingEntries.map((entry) => entry.id))
        : null,
    [matchingEntries, needsSearchIndex, searchIndex],
  );

  const requiredCategories = useMemo<Set<string> | null>(() => {
    if (browseMode) return null;
    if (needsSearchIndex && !searchIndex) return new Set();
    if (activeCategories.size > 0) return new Set(activeCategories);
    return categoriesForSearchEntries(matchingEntries);
  }, [activeCategories, browseMode, matchingEntries, needsSearchIndex, searchIndex]);
  const requiredCategoryKey = useMemo(
    () => Array.from(requiredCategories ?? []).sort().join("\u0000"),
    [requiredCategories],
  );

  const rebuildBrowseCasesFromCache = useCallback((categories: Set<string>) => {
    const cases = [...HOME_DATA.initial];
    for (const category of categories) {
      const cached = getCachedShard(category);
      if (cached) cases.push(...cached);
    }
    setShardCases(uniqueCases(cases));
  }, []);

  const loadMoreBrowse = useCallback(async () => {
    if (isSSR || browseLoadingRef.current) return;
    const nextCategories = BROWSE_CATEGORY_ORDER.filter(
      (category) => !browseLoadedCategories.has(category),
    ).slice(0, BROWSE_BATCH_SIZE);
    if (nextCategories.length === 0) return;

    browseLoadingRef.current = true;
    setBrowseLoading(true);
    setLoadError(null);
    const results = await Promise.allSettled(nextCategories.map((category) => loadShard(category)));
    const loaded = new Set(browseLoadedCategories);
    const cases = [...shardCases];
    const failed: string[] = [];
    results.forEach((result, index) => {
      const category = nextCategories[index];
      if (result.status === "fulfilled") {
        loaded.add(category);
        cases.push(...result.value);
      } else {
        failed.push(category);
      }
    });
    setBrowseLoadedCategories(loaded);
    setShardCases(uniqueCases(cases));
    if (failed.length > 0) {
      setLoadError(`部分案例加载失败：${failed.join("、")}`);
    }
    browseLoadingRef.current = false;
    setBrowseLoading(false);
  }, [browseLoadedCategories, isSSR, shardCases]);

  useEffect(() => {
    if (isSSR || !browseMode) return;
    rebuildBrowseCasesFromCache(browseLoadedCategories);
    if (browseLoadedCategories.size === 0) void loadMoreBrowse();
  }, [
    browseLoadedCategories,
    browseMode,
    isSSR,
    loadMoreBrowse,
    rebuildBrowseCasesFromCache,
  ]);

  useEffect(() => {
    if (isSSR || browseMode) return;
    if (needsSearchIndex && (searchLoading || !searchIndex)) {
      setFilteredLoading(true);
      return;
    }

    const categories = requiredCategoryKey ? requiredCategoryKey.split("\u0000") : [];
    if (categories.length === 0) {
      setShardCases([]);
      setFilteredLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setFilteredLoading(true);
    setLoadError(null);
    Promise.all(categories.map((category) => loadShard(category)))
      .then((results) => {
        if (!cancelled) setShardCases(uniqueCases(results.flat()));
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLoadError(reason instanceof Error ? reason.message : "案例加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) setFilteredLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    browseMode,
    isSSR,
    loadAttempt,
    needsSearchIndex,
    requiredCategoryKey,
    searchIndex,
    searchLoading,
  ]);

  const baseList = useMemo<PromptCase[]>(() => {
    const candidates = isSSR ? HOME_DATA.initial : shardCases;
    return sortCasesForDisplay(candidates);
  }, [isSSR, shardCases]);

  const filtered = useMemo(() => {
    if (needsSearchIndex && !matchingIds) return [];
    return baseList.filter((item) => {
      if (matchingIds && !matchingIds.has(item.id)) return false;
      if (showFavorites && !favoriteIds.has(item.id)) return false;
      if (activeCategories.size > 0) {
        const categories = new Set([item.userCategory, ...(item.userCategories ?? [])]);
        if (!Array.from(activeCategories).some((category) => categories.has(category as never))) {
          return false;
        }
      }
      return true;
    });
  }, [
    activeCategories,
    baseList,
    favoriteIds,
    matchingIds,
    needsSearchIndex,
    showFavorites,
  ]);

  const totalCount = isSSR ? ALL_CASES.length : HOME_DATA.totalCount;
  const displayedMatchCount = !hydrated
    ? totalCount
    : needsSearchIndex
      ? searchIndex
        ? matchingEntries.length
        : totalCount
      : activeCategories.size > 0
        ? filteredLoading
          ? totalCount
          : filtered.length
        : totalCount;

  const resetFilters = useCallback(() => {
    setQuery("");
    setActiveCategories(new Set());
    setActiveStyles(new Set());
    setActiveScenes(new Set());
    setActivePlatforms(new Set());
    setShowFavorites(false);
  }, []);

  const retryLoads = useCallback(() => {
    setLoadError(null);
    if (searchError) retrySearch();
    if (browseMode) void loadMoreBrowse();
    else setLoadAttempt((value) => value + 1);
  }, [browseMode, loadMoreBrowse, retrySearch, searchError]);

  const favoriteCount = favoriteIds.size;
  const statusMessage = searchLoading
    ? "正在搜索完整案例库…"
    : filteredLoading
      ? "正在加载匹配案例…"
      : browseLoading
        ? "正在加载更多案例…"
        : null;

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
            onClick={() => setShowFavorites((value) => !value)}
            disabled={favoriteCount === 0}
            aria-pressed={showFavorites}
            className={
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 " +
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
        styles={filterOptions?.styles ?? []}
        activeStyles={activeStyles}
        onStylesChange={setActiveStyles}
        scenes={filterOptions?.scenes ?? []}
        activeScenes={activeScenes}
        onScenesChange={setActiveScenes}
        activePlatforms={activePlatforms}
        onPlatformsChange={setActivePlatforms}
        total={totalCount}
        matched={displayedMatchCount}
        hasActiveFilter={hasActiveFilter || showFavorites}
        onReset={resetFilters}
      />

      <div className="container-narrow" aria-live="polite" aria-atomic="true">
        {statusMessage && <p className="pb-3 text-sm text-ink-300">{statusMessage}</p>}
        {(loadError || searchError) && (
          <div
            role="alert"
            className="mb-4 flex flex-col gap-3 rounded-2xl border border-ember-500/25 bg-ember-500/10 px-4 py-3 text-sm text-ink-100 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>案例库暂时没有加载完整，请重试。</span>
            <button type="button" onClick={retryLoads} className="btn-ghost shrink-0">
              重新加载
            </button>
          </div>
        )}
      </div>

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
        loading={(searchLoading || filteredLoading) && filtered.length === 0}
        loadingMore={browseLoading}
        hasMoreData={browseMode && browseLoadedCategories.size < BROWSE_CATEGORY_ORDER.length}
        onLoadMoreData={loadMoreBrowse}
      />
    </>
  );
}
