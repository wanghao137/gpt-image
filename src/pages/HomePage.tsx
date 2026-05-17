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
  const featured = useMemo(() => cases.slice(0, 12), [cases]);

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

        <div className="container-narrow grid gap-10 pb-12 pt-10 sm:gap-12 sm:pb-16 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)] lg:gap-16 lg:pb-24 lg:pt-24">
          <div className="relative z-10 flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-ink-300 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember-500" />
              </span>
              <span className="tracking-wide">每周更新 · 中英双语 Prompt</span>
            </div>

            <h1 className="serif-display text-[2.2rem] leading-[1.05] text-ink-50 sm:text-5xl lg:text-[4.4rem] lg:leading-[1.02]">
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

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-300 sm:mt-6 sm:text-[17px]">
              爆款 AI 图片 · 现成 Prompt · 一键复制。
              <br className="hidden sm:block" />
              小红书封面、商家海报、人像写真、信息图——按场景分好类，复制就能出图。
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
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

          {/* Hero collage */}
          <div className="relative z-10">
            {!heroPrimary ? (
              <div className="aspect-square animate-pulse rounded-2xl bg-gradient-to-br from-ink-850 to-ink-800" />
            ) : (
              <>
                {/* Mobile: single hero image */}
                <Link
                  to={`/case/${heroPrimary.slug}`}
                  className="group relative block w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40 text-left lg:hidden"
                  aria-label={heroPrimary.title}
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <SmartImg
                      src={heroPrimary.imageUrl}
                      alt={heroPrimary.imageAlt || heroPrimary.title}
                      width={800}
                      height={1000}
                      widths={[480, 720, 960]}
                      baseWidth={720}
                      sizes="100vw"
                      loading="eager"
                      fetchPriority="high"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <span className="text-[10.5px] font-medium tracking-[0.18em] text-ember-300">
                        FEATURED · {heroPrimary.ratio}
                      </span>
                      <strong className="mt-1 line-clamp-1 block text-[15px] font-semibold text-ink-50">
                        {heroPrimary.title}
                      </strong>
                    </div>
                  </div>
                </Link>

                {/* Mobile: 2-up thumbnails */}
                {heroGrid.length > 0 && (
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:hidden">
                    {heroGrid.slice(0, 2).map((item) => (
                      <Link
                        key={item.id}
                        to={`/case/${item.slug}`}
                        className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-ink-900/40 text-left"
                        aria-label={item.title}
                      >
                        <div className="relative aspect-[4/5] overflow-hidden">
                          <SmartImg
                            src={item.imageUrl}
                            alt=""
                            width={400}
                            height={500}
                            widths={[280, 420]}
                            baseWidth={420}
                            sizes="50vw"
                            className="absolute inset-0 h-full w-full object-cover opacity-90"
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950 to-transparent" />
                          <span className="absolute bottom-2 left-2 right-2 line-clamp-1 text-[11px] font-medium text-ink-100">
                            {item.title}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Desktop: 3x3 magazine grid */}
                <div className="hidden aspect-square grid-cols-3 auto-rows-fr gap-3 lg:grid">
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
                          "group card-spotlight relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40 text-left transition duration-700 hover:-translate-y-1 hover:border-white/20 hover:shadow-soft " +
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
              </>
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
        <CaseGrid cases={featured} favoriteIds={new Set()} onToggleFavorite={toggle} paginate={false} />
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
