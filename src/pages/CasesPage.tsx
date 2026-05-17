import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ALL_CASES } from "../lib/data";
import { CaseGrid } from "../components/CaseGrid";
import { FilterBar } from "../components/FilterBar";
import { SEO } from "../components/SEO";
import { useFavorites } from "../hooks/useFavorites";

function uniqueValues(items: string[][]): string[] {
  return Array.from(new Set(items.flat())).sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN"),
  );
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

/**
 * Full case library. Filter / search / favorite state is mirrored to the URL
 * so links to "/cases?cat=portrait,xhs-cover&platform=xiaohongshu" are
 * shareable and survive refresh — important for SEO long tail and for
 * "send this filtered view to a client" kind of flows.
 */
export default function CasesPage() {
  const [sp, setSp] = useSearchParams();
  const cases = ALL_CASES;
  const { ids: favoriteIds, toggle } = useFavorites();

  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(() =>
    readSet(sp, "cat"),
  );
  const [activeStyles, setActiveStyles] = useState<Set<string>>(() => readSet(sp, "style"));
  const [activeScenes, setActiveScenes] = useState<Set<string>>(() => readSet(sp, "scene"));
  const [activePlatforms, setActivePlatforms] = useState<Set<string>>(() =>
    readSet(sp, "platform"),
  );
  const [showFavorites, setShowFavorites] = useState(false);

  // ── URL sync (one-way: state → URL) ──
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (query) next.set("q", query);
    else next.delete("q");
    writeSet(next, "cat", activeCategories);
    writeSet(next, "style", activeStyles);
    writeSet(next, "scene", activeScenes);
    writeSet(next, "platform", activePlatforms);
    if (next.toString() !== sp.toString()) {
      setSp(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeCategories, activeStyles, activeScenes, activePlatforms]);

  // ── derived filter option lists ──
  const styleOptions = useMemo(() => uniqueValues(cases.map((c) => c.styles)), [cases]);
  const sceneOptions = useMemo(() => uniqueValues(cases.map((c) => c.scenes)), [cases]);

  const baseList = useMemo(() => {
    if (showFavorites) return cases.filter((c) => favoriteIds.has(c.id));
    return cases;
  }, [cases, favoriteIds, showFavorites]);

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
        if (!c.styles.some((s) => activeStyles.has(s))) return false;
      }
      if (activeScenes.size > 0) {
        if (!c.scenes.some((s) => activeScenes.has(s))) return false;
      }
      if (activePlatforms.size > 0) {
        if (!(c.platforms ?? []).some((p) => activePlatforms.has(p))) return false;
      }
      if (!q) return true;
      const text = [
        c.id,
        c.title,
        c.category,
        c.promptPreview,
        c.source,
        ...c.tags,
        ...c.styles,
        ...c.scenes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [baseList, activeCategories, activeStyles, activeScenes, activePlatforms, query]);

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

  return (
    <>
      <SEO
        title={`全部案例 · ${cases.length}+ GPT-Image 2 真实案例`}
        description="按用例、风格、场景、平台筛选 GPT-Image 2 中文案例库的全部案例。一键复制 Prompt，免费用作灵感来源。"
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
      />
    </>
  );
}
