import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ALL_CASES } from "../lib/data";
import { CaseGrid } from "../components/CaseGrid";
import { SEO, SITE } from "../components/SEO";
import { useFavorites } from "../hooks/useFavorites";
import { HOMEPAGE_USER_CATEGORIES } from "../lib/userCategories";
import type { UserCategoryKey } from "../types";

const HOME_TITLE = "GPT-Image 2 中文案例库";
const HOME_DESC =
  "小红书封面、商家海报、人像写真、信息图，450+ 个 GPT-Image 2 真实案例，按场景分类，中英双语 Prompt，一键复制就能出图。";

/**
 * Home — gallery-first.
 *
 * The previous home rebuilt around a hero + metrics + category showcase
 * pushed the actual cases below the fold. Real users come here to *see
 * cases*, so the hero is reduced to a one-line title row, and the body is
 * a category chip rail + the same masonry feed as `/cases`. Filtering is
 * client-only (no URL sync — that's `/cases`'s job) so the page stays SSG-
 * cheap and instant to switch between.
 *
 * The chip rail sticks under the header on mobile so the "switch category"
 * affordance never leaves the viewport during a long scroll.
 */
export default function HomePage() {
  const cases = ALL_CASES;
  const { ids: favoriteIds, toggle } = useFavorites();
  const [activeCategory, setActiveCategory] = useState<UserCategoryKey | "all">("all");

  const filtered = useMemo(() => {
    if (activeCategory === "all") return cases;
    return cases.filter((c) => {
      if (c.userCategory === activeCategory) return true;
      return (c.userCategories ?? []).includes(activeCategory);
    });
  }, [cases, activeCategory]);

  // Derive a count map up-front so chips can show "{label} 42" without
  // rescanning the dataset on every render.
  const countByKey = useMemo(() => {
    const map = new Map<UserCategoryKey, number>();
    for (const c of cases) {
      map.set(c.userCategory, (map.get(c.userCategory) ?? 0) + 1);
      for (const k of c.userCategories ?? []) {
        if (k !== c.userCategory) map.set(k, (map.get(k) ?? 0) + 1);
      }
    }
    return map;
  }, [cases]);

  const ldOrg = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: HOME_TITLE,
    url: SITE.url,
    description: HOME_DESC,
    inLanguage: "zh-CN",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE.url}/cases?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  // Front-of-feed sample for the ItemList — Google likes seeing 10–20 items.
  const ldItemList = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "GPT-Image 2 中文案例 · 精选",
      numberOfItems: Math.min(cases.length, 24),
      itemListElement: cases.slice(0, 24).map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE.url}/case/${c.slug}`,
        name: c.title,
        image: c.imageUrl,
      })),
    }),
    [cases],
  );

  return (
    <>
      <SEO title={HOME_TITLE} description={HOME_DESC} path="/" jsonLd={[ldOrg, ldItemList]} />

      {/* COMPACT INTRO — replaces the full hero. Two lines tops. */}
      <section className="container-narrow pb-3 pt-7 sm:pb-4 sm:pt-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            <p className="eyebrow">Gallery</p>
            <h1 className="serif-display mt-1.5 text-[24px] leading-[1.1] text-ink-50 sm:text-[34px] lg:text-[42px]">
              GPT-Image 2 中文案例库
              <span className="ml-2 align-middle text-[13px] font-medium tabular-nums text-ink-400 sm:ml-3 sm:text-[15px]">
                {cases.length} 个
              </span>
            </h1>
          </div>
          <p className="hidden max-w-md text-[13px] text-ink-400 sm:block sm:text-[14px]">
            按场景筛选、看图、一键复制中英双语 Prompt 到 ChatGPT 出图。
          </p>
        </div>
      </section>

      {/* STICKY CATEGORY RAIL — single source of truth for switching feeds.
          On mobile it sticks under the site header; on desktop it scrolls
          with the page. This is the page's only nav surface beyond the
          global header. */}
      <CategoryChipRail
        active={activeCategory}
        onChange={setActiveCategory}
        countByKey={countByKey}
        total={cases.length}
      />

      {/* The actual feed. Reuses the same masonry grid `/cases` uses, with
          infinite scroll on. priorityCount=2 so the first row of cards
          competes with the chip rail for fetchpriority instead of nothing. */}
      <div className="pt-4 sm:pt-6">
        <CaseGrid
          cases={filtered}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggle}
          paginate
          priorityCount={2}
          onResetFilters={() => setActiveCategory("all")}
        />
      </div>

      {/* Long-tail SEO: every category linked at the bottom even if not in
          the chip rail's pinned 12. */}
      <FooterCategoryNav />
    </>
  );
}

// ──────────────────────────────────────────────── chip rail ──

interface CategoryChipRailProps {
  active: UserCategoryKey | "all";
  onChange: (next: UserCategoryKey | "all") => void;
  countByKey: Map<UserCategoryKey, number>;
  total: number;
}

/**
 * Horizontally-scrollable chip rail that sticks to the top of the
 * viewport on mobile and sits inline on desktop. The active chip
 * auto-scrolls into view when changed via keyboard or external state,
 * so power users using arrow keys never lose track.
 */
function CategoryChipRail({ active, onChange, countByKey, total }: CategoryChipRailProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = activeChipRef.current;
    const rail = railRef.current;
    if (!el || !rail) return;
    // Only scroll horizontally — `scrollIntoView` would also scroll the
    // page vertically, which is jarring when sticky.
    const elBox = el.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    if (elBox.left < railBox.left || elBox.right > railBox.right) {
      rail.scrollTo({
        left: rail.scrollLeft + (elBox.left - railBox.left) - 24,
        behavior: "smooth",
      });
    }
  }, [active]);

  return (
    <div
      className="sticky top-16 z-20 -mx-5 border-b border-white/[0.04] bg-ink-950/80 backdrop-blur-md sm:relative sm:top-auto sm:mx-0 sm:border-b-0 sm:bg-transparent sm:backdrop-blur-none"
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
    >
      <div className="container-narrow sm:px-0">
        <div
          ref={railRef}
          className="mask-fade-x flex items-center gap-1.5 overflow-x-auto scrollbar-thin px-5 py-3 sm:flex-wrap sm:px-0"
          role="tablist"
          aria-label="按场景筛选"
        >
          <ChipButton
            active={active === "all"}
            onClick={() => onChange("all")}
            label="全部"
            count={total}
          />
          {HOMEPAGE_USER_CATEGORIES.map((cat) => {
            const isActive = active === cat.key;
            return (
              <ChipButton
                key={cat.key}
                ref={isActive ? activeChipRef : undefined}
                active={isActive}
                onClick={() => onChange(cat.key)}
                label={cat.label}
                count={countByKey.get(cat.key) ?? 0}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// React.forwardRef lets the rail capture the active chip's node so it can
// auto-scroll it into view.
interface ChipButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}

const ChipButton = forwardRef<HTMLButtonElement, ChipButtonProps>(function ChipButton(
  { active, onClick, label, count },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition " +
        (active
          ? "border-ember-500/60 bg-ember-500/15 text-ember-100 shadow-[0_0_0_1px_rgba(217,119,87,0.18)_inset]"
          : "border-white/10 bg-white/[0.03] text-ink-200 hover:border-white/25 hover:text-ink-50")
      }
    >
      <span>{label}</span>
      <span
        className={
          "rounded-full px-1.5 py-0.5 text-[10.5px] tabular-nums " +
          (active ? "bg-ink-950/40 text-ember-100" : "bg-ink-950/40 text-ink-400")
        }
      >
        {count}
      </span>
    </button>
  );
});

// ──────────────────────────────────────────── footer category nav ──

function FooterCategoryNav() {
  return (
    <section className="container-narrow border-t border-white/[0.04] pb-12 pt-10 sm:pb-16 sm:pt-12">
      <p className="eyebrow">All categories</p>
      <h2 className="mt-1.5 text-[15px] font-semibold text-ink-100 sm:text-[16px]">
        按场景浏览全部分类
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {HOMEPAGE_USER_CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            to={`/category/${cat.slug}`}
            className="chip chip-idle"
            aria-label={`${cat.label} 分类`}
          >
            {cat.label}
          </Link>
        ))}
        <Link to="/cases" className="chip chip-active">
          全部案例 →
        </Link>
      </div>
    </section>
  );
}
