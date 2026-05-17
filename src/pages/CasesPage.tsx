import { useCallback, useMemo, useState } from "react";
import { ALL_CASES } from "../lib/data";
import { CaseGrid } from "../components/CaseGrid";
import { FilterBar } from "../components/FilterBar";
import { SEO } from "../components/SEO";
import { useFavorites } from "../hooks/useFavorites";
import { userCategoryLabel, USER_CATEGORIES } from "../lib/userCategories";

const ALL = "全部";

function uniqueOptions(items: string[][]) {
  return [
    ALL,
    ...Array.from(new Set(items.flat())).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
  ];
}

/**
 * Full case library page. Same filter/search/grid as the original homepage,
 * but standalone so the home page can stay conversion-focused while this page
 * carries the long-tail browsing/SEO weight.
 */
export default function CasesPage() {
  const cases = ALL_CASES;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [styleFilter, setStyleFilter] = useState(ALL);
  const [scene, setScene] = useState(ALL);
  const [showFavorites, setShowFavorites] = useState(false);
  const { ids: favoriteIds, toggle, has: _has } = useFavorites();
  void _has;

  const userCategoryOptions = useMemo(
    () => [
      ALL,
      ...USER_CATEGORIES.filter((c) => cases.some((x) => x.userCategory === c.key)).map(
        (c) => c.label,
      ),
    ],
    [cases],
  );

  const styleOptions = useMemo(() => uniqueOptions(cases.map((item) => item.styles)), [cases]);
  const scenes = useMemo(() => uniqueOptions(cases.map((item) => item.scenes)), [cases]);

  const baseList = useMemo(() => {
    if (showFavorites) return cases.filter((item) => favoriteIds.has(item.id));
    return cases;
  }, [cases, favoriteIds, showFavorites]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseList.filter((item) => {
      const inCategory =
        category === ALL || userCategoryLabel(item.userCategory) === category;
      const inStyle = styleFilter === ALL || item.styles.includes(styleFilter);
      const inScene = scene === ALL || item.scenes.includes(scene);
      if (!inCategory || !inStyle || !inScene) return false;
      if (!q) return true;
      const text = [
        item.id,
        item.title,
        item.category,
        item.promptPreview,
        item.source,
        ...item.tags,
        ...item.styles,
        ...item.scenes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [baseList, category, query, scene, styleFilter]);

  const hasActiveFilter =
    query.trim().length > 0 || category !== ALL || styleFilter !== ALL || scene !== ALL;

  const resetFilters = useCallback(() => {
    setQuery("");
    setCategory(ALL);
    setStyleFilter(ALL);
    setScene(ALL);
  }, []);

  const favoriteCount = favoriteIds.size;

  return (
    <>
      <SEO
        title="全部案例 · 435+ GPT-Image 2 真实案例"
        description="按用例、风格、场景筛选 GPT-Image 2 中文案例库的全部案例。一键复制 Prompt，免费用作灵感来源。"
        path="/cases"
      />

      <section className="container-narrow pb-2 pt-10 sm:pt-14">
        <p className="eyebrow">All Cases</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="serif-display text-[28px] text-ink-50 sm:text-4xl lg:text-[44px]">
            按场景筛选 {cases.length} 个 GPT-Image 2 案例
          </h1>
          <button
            type="button"
            onClick={() => setShowFavorites((v) => !v)}
            disabled={favoriteCount === 0}
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 " +
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
        categories={userCategoryOptions}
        activeCategory={category}
        onCategoryChange={setCategory}
        styles={styleOptions}
        activeStyle={styleFilter}
        onStyleChange={setStyleFilter}
        scenes={scenes}
        activeScene={scene}
        onSceneChange={setScene}
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
      />
    </>
  );
}
