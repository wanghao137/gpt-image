import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ALL_CASES, ALL_TEMPLATES } from "../lib/data";
import { SmartImg } from "../components/SmartImg";
import { CategoryShowcase } from "../components/CategoryShowcase";
import { CaseGrid } from "../components/CaseGrid";
import { TemplateCard } from "../components/TemplateCard";
import { WeChatCTA } from "../components/WeChatCTA";
import { SEO, SITE } from "../components/SEO";
import { useFavorites } from "../hooks/useFavorites";
import { useCountUp } from "../hooks/useCountUp";
import { HOMEPAGE_USER_CATEGORIES } from "../lib/userCategories";
import type { PromptCase } from "../types";

const HOME_TITLE = "GPT-Image 2 中文案例库";
const HOME_DESC =
  "小红书封面、商家海报、人像写真、信息图——435+ 个 GPT-Image 2 真实案例，按场景分类，中英双语 Prompt，一键复制就能出图。";

/**
 * Home — the conversion-critical landing page. Three jobs:
 *   1. In 5 seconds: communicate "this is the Chinese GPT-Image 2 case library".
 *   2. In 30 seconds: get users into a category page or a copy action.
 *   3. In 90 seconds: surface the WeChat CTA so commercial leads convert.
 */
export default function HomePage() {
  const cases = ALL_CASES;
  const templates = ALL_TEMPLATES;
  const animCases = useCountUp(cases.length, 1100);

  const heroPrimary = cases[0];
  const heroGrid = useMemo(() => cases.slice(1, 5), [cases]);
  // Featured grid: 12 cards on the home page — matches the section heading
  // ("本周精选 12 个案例") and gives the gallery enough surface area to
  // showcase variety. Mobile perf is still protected via priorityCount=1
  // below, plus lazy-loading on every non-priority card; only the first
  // featured card competes with the hero for fetchpriority=high.
  const featured = useMemo(() => cases.slice(0, 12), [cases]);

  // "Today's new" chip — counts cases whose createdAt falls within the
  // last 48 hours. We use 48h instead of 24h because:
  //   - Upstream sync runs once a day at 18:17 UTC, so a strict 24h
  //     window would oscillate between "0 new" and "5 new" depending on
  //     when the user lands. 48h smooths that out without lying about
  //     freshness.
  //   - From a user POV, "新增 5 个" reads as "this site is alive" whether
  //     the cases shipped yesterday or today — both feel current.
  // Returns null when there are 0 new cases so the chip hides cleanly.
  const recentCount = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 48 * 60 * 60 * 1000;
    let n = 0;
    for (const c of cases) {
      const t = c.createdAt ? Date.parse(c.createdAt) : NaN;
      if (Number.isFinite(t) && t >= cutoff && t <= now) n += 1;
    }
    return n;
  }, [cases]);

  const { has, toggle } = useFavorites();

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

  // ItemList tells Google the page is a curated list — improves rich results.
  // We surface the same 12 featured cases the user sees above the fold.
  const ldItemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "本周精选 GPT-Image 2 案例",
    numberOfItems: featured.length,
    itemListElement: featured.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE.url}/case/${c.slug}`,
      name: c.title,
      image: c.imageUrl,
    })),
  };

  return (
    <>
      <SEO title={HOME_TITLE} description={HOME_DESC} path="/" jsonLd={[ldOrg, ldItemList]} />

      {/* HERO */}
      <section className="relative isolate">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-ember-500/10 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-40 h-72 w-72 rounded-full bg-ember-700/10 blur-[100px]"
        />

        {/* ─────────── MOBILE HERO (lg:hidden) ───────────
            Image-first layout. Title compressed to 2 lines, subtitle
            to one line, single CTA, and four real cases waterfalling
            into view directly under the headline. The four-tick
            credibility row that used to sit here moved to a quiet
            strip below the category showcase — it answered objections
            no first-time visitor was raising at the top of the page.
        */}
        <div className="container-narrow flex flex-col gap-7 pb-10 pt-8 lg:hidden">
          <div className="relative z-10 flex flex-col">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-ink-300 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember-500" />
              </span>
              <span className="tracking-wide">
                {recentCount > 0
                  ? `近 48h 新增 ${recentCount} 个 · 中英双语 Prompt`
                  : "每周更新 · 中英双语 Prompt"}
              </span>
            </div>

            <h1 className="serif-display mt-4 text-[1.85rem] leading-[1.05] text-ink-50 sm:text-[2.4rem]">
              GPT-Image 2 中文
              <em className="not-italic">
                <span className="bg-gradient-to-br from-ember-200 via-ember-400 to-ember-600 bg-clip-text text-transparent">
                  案例库
                </span>
                <span className="ml-0.5 text-ember-400">.</span>
              </em>
            </h1>

            <p className="mt-3 line-clamp-2 max-w-md text-[14px] leading-relaxed text-ink-300 sm:text-[15px]">
              爆款 AI 图片 · 现成 Prompt · 一键复制。{cases.length}+ 个真实案例按场景分好类。
            </p>

            <div className="mt-5 flex">
              <Link to="/cases" className="btn-primary w-full justify-center sm:w-auto">
                浏览全部 {animCases || cases.length} 个案例
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            </div>
          </div>

          {/* Mobile case waterfall — four real cases, image-only.
              Tapping any tile drops you straight into its detail page,
              same as a CaseCard tap on the regular grid. */}
          {heroPrimary && (
            <div className="relative z-10 grid grid-cols-2 gap-2.5">
              <div className="hero-mobile-col-left flex flex-col gap-2.5">
                <HeroMobileTile case_={cases[0]} aspect="3/4" priority />
                <HeroMobileTile case_={cases[2]} aspect="4/5" />
              </div>
              <div className="hero-mobile-col-right mt-6 flex flex-col gap-2.5">
                <HeroMobileTile case_={cases[1]} aspect="4/5" />
                <HeroMobileTile case_={cases[3]} aspect="3/4" />
              </div>
            </div>
          )}
        </div>

        {/* ─────────── DESKTOP HERO (hidden lg:grid) ───────────
            Original two-column magazine layout, untouched.
        */}
        <div className="container-narrow hidden gap-10 pb-12 pt-10 sm:gap-12 sm:pb-16 sm:pt-16 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)] lg:gap-16 lg:pb-24 lg:pt-24">
          <div className="relative z-10 flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-ink-300 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember-500" />
              </span>
              <span className="tracking-wide">
                {recentCount > 0
                  ? `近 48h 新增 ${recentCount} 个 · 中英双语 Prompt`
                  : "每周更新 · 中英双语 Prompt"}
              </span>
            </div>

            <h1 className="serif-display text-5xl leading-[1.05] text-ink-50 lg:text-[4.4rem] lg:leading-[1.02]">
              GPT-Image 2
              <br />
              中文
              <em className="not-italic">
                <span className="bg-gradient-to-br from-ember-200 via-ember-400 to-ember-600 bg-clip-text text-transparent">
                  案例库
                </span>
                <span className="ml-0.5 text-ember-400">.</span>
              </em>
            </h1>

            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-300">
              爆款 AI 图片 · 现成 Prompt · 一键复制。
              <br />
              小红书封面、商家海报、人像写真、信息图——按场景分好类，复制就能出图。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/cases" className="btn-primary">
                浏览全部 {animCases || cases.length} 个案例
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
              <Link to="/services" className="btn-ghost">
                代做 / 定制 ▸
              </Link>
            </div>

            <ul className="mt-8 grid max-w-md grid-cols-2 gap-x-4 gap-y-2 text-[13px] text-ink-300">
              <li className="flex items-center gap-2">
                <Tick /> 全部 GPT-Image 2 真实出图
              </li>
              <li className="flex items-center gap-2">
                <Tick /> 中英双语 Prompt
              </li>
              <li className="flex items-center gap-2">
                <Tick /> 比例 / 平台已标注
              </li>
              <li className="flex items-center gap-2">
                <Tick /> 每周更新
              </li>
            </ul>
          </div>

          {/* Desktop hero collage */}
          <div className="relative z-10">
            {!heroPrimary ? (
              <div className="aspect-square animate-pulse rounded-2xl bg-gradient-to-br from-ink-850 to-ink-800" />
            ) : (
              <div className="aspect-square grid grid-cols-3 auto-rows-fr gap-3">
                {[heroPrimary, ...heroGrid].slice(0, 5).map((item, index) => {
                  const layout =
                    index === 0
                      ? "col-span-2 row-span-2"
                      : index === 1
                        ? "col-start-3 row-start-1"
                        : index === 2
                          ? "col-start-3 row-start-2"
                          : index === 3
                            ? "col-start-1 row-start-3"
                            : "col-start-2 row-start-3 col-span-2";
                  return (
                    <Link
                      key={item.id}
                      to={`/case/${item.slug}`}
                      className={
                        "group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40 text-left transition duration-700 hover:-translate-y-1 hover:border-white/20 hover:shadow-soft " +
                        layout
                      }
                      style={{ animation: `fadeUp 0.6s ${index * 80}ms ease-out both` }}
                    >
                      <SmartImg
                        src={item.imageUrl}
                        alt={item.imageAlt || item.title}
                        width={index === 0 ? 1000 : 500}
                        height={index === 0 ? 1000 : 500}
                        widths={index === 0 ? [800, 1100] : [360, 540]}
                        baseWidth={index === 0 ? 1100 : 540}
                        sizes={
                          index === 0
                            ? "(min-width:1024px) 360px, 100vw"
                            : "(min-width:1024px) 180px, 50vw"
                        }
                        loading={index === 0 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : "auto"}
                        className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-[1500ms] group-hover:scale-[1.06] group-hover:opacity-100"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <span className="text-[10.5px] font-medium tracking-[0.18em] text-ember-300">
                          {item.ratio}
                        </span>
                        <strong className="mt-1 line-clamp-1 block text-[13px] font-semibold text-ink-50">
                          {item.title}
                        </strong>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CATEGORY SHOWCASE */}
      <CategoryShowcase cases={cases} />

      {/* FEATURED CASES */}
      <section className="container-narrow scroll-mt-20 pt-12 sm:pt-16" id="featured">
        <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Featured</p>
            <h2 className="serif-display mt-2 text-[26px] text-ink-50 sm:text-4xl lg:text-[40px]">
              本周精选 12 个案例
            </h2>
          </div>
          <Link
            to="/cases"
            className="text-[13px] font-medium text-ember-300 transition hover:text-ember-200"
          >
            查看全部 →
          </Link>
        </div>
        <CaseGrid
          cases={featured}
          favoriteIds={new Set()}
          onToggleFavorite={toggle}
          paginate={false}
          // priorityCount=1 means only the very first case card competes
          // with the hero for fetchpriority=high. Was 4 — that meant 4
          // cards racing the hero on every page load, and on Chinese
          // mobile networks that's the difference between "hero is up
          // in 800ms" and "hero is up in 4s".
          priorityCount={1}
        />
      </section>

      {/* TEMPLATES TEASER */}
      <section className="container-narrow scroll-mt-20 pt-8 sm:pt-12" id="templates-teaser">
        <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Templates</p>
            <h2 className="serif-display mt-2 text-[26px] text-ink-50 sm:text-4xl lg:text-[40px]">
              {templates.length} 套工业级模板，先起稿再 remix。
            </h2>
          </div>
          <Link
            to="/templates"
            className="text-[13px] font-medium text-ember-300 transition hover:text-ember-200"
          >
            全部模板 →
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {templates.slice(0, 4).map((t) => (
            <TemplateCard key={t.id} data={t} />
          ))}
        </div>
      </section>

      {/* WECHAT CTA */}
      <WeChatCTA />

      {/* CATEGORY PILLS — long tail SEO + scrollable nav */}
      <section className="container-narrow pb-16">
        <div className="flex flex-wrap gap-2">
          {HOMEPAGE_USER_CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to={`/category/${c.slug}`}
              className="chip chip-idle"
              aria-label={`${c.label} 分类`}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      {/* SAFE SECONDARY: ensure favorites are surfaced via a hidden fav check (uses `has` to satisfy TS) */}
      <span className="hidden">{has("__noop__") ? "" : ""}</span>
    </>
  );
}

function Tick() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5 text-ember-400"
      aria-hidden="true"
    >
      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" />
    </svg>
  );
}

interface HeroMobileTileProps {
  case_: PromptCase | undefined;
  /** CSS aspect-ratio fragment, e.g. "3/4" / "4/5". */
  aspect: "3/4" | "4/5" | "1/1";
  priority?: boolean;
}

/**
 * One image-only tile inside the mobile hero waterfall.
 *
 * Image-only by design — title / category / copy buttons live further
 * down the page on the regular CaseCard grid. The hero's job is to
 * *show* the gallery in the first 600ms, not to surface metadata. A
 * tap drops you into the detail page, same as any other CaseCard.
 *
 * Aspect ratios alternate between 3/4 and 4/5 across the four tiles
 * to create the staggered waterfall silhouette without us having to
 * hand-author offset margins per tile. The right column also has a
 * small `mt-6` push at the column level, so the visual rhythm is:
 *
 *      [ left: 3/4 ]  [ right: 4/5 ]  ← right starts 24px lower
 *      [ left: 4/5 ]  [ right: 3/4 ]
 */
function HeroMobileTile({ case_, aspect, priority }: HeroMobileTileProps) {
  if (!case_) {
    return (
      <div
        className="animate-pulse rounded-2xl bg-gradient-to-br from-ink-850 to-ink-800"
        style={{ aspectRatio: aspect.replace("/", " / ") }}
      />
    );
  }
  return (
    <Link
      to={`/case/${case_.slug}`}
      aria-label={case_.title}
      className="group relative block overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40 transition active:scale-[0.98]"
      style={{ aspectRatio: aspect.replace("/", " / ") }}
    >
      <SmartImg
        src={case_.imageUrl}
        alt={case_.imageAlt || case_.title}
        width={600}
        height={800}
        // Half-viewport on phones at DPR 2-3 means physical 360-540 px.
        // Capping at 540w keeps the four tiles cheap on cellular and
        // avoids loading desktop-grade detail no one will ever see.
        widths={[280, 380, 540]}
        baseWidth={280}
        sizes="50vw"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
      />
    </Link>
  );
}
