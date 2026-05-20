import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ALL_CASES, ALL_TEMPLATES } from "../lib/data";
import { SmartImg } from "../components/SmartImg";
import { CategoryShowcase } from "../components/CategoryShowcase";
import { CaseGrid } from "../components/CaseGrid";
import { TemplateCard } from "../components/TemplateCard";
import { HeroStrip } from "../components/HeroStrip";
import { SEO, SITE } from "../components/SEO";
import { useFavorites } from "../hooks/useFavorites";
import { useCountUp } from "../hooks/useCountUp";
import { HOMEPAGE_USER_CATEGORIES } from "../lib/userCategories";
import type { PromptCase } from "../types";

const HOME_TITLE = "GPT-Image 2 中文案例库";
const HOME_DESC =
  "小红书封面、商家海报、人像写真、信息图，450+ 个 GPT-Image 2 真实案例，按场景分类，中英双语 Prompt，一键复制就能出图。";

/**
 * Home — restored to the hero + collage + featured layout that performed
 * well visually. Differences from the previous incarnation:
 *   - The "代做 / 定制" ghost CTA pointed to `/services`; that route is
 *     gone, so the hero now ships with a single primary CTA.
 *   - The `<WeChatCTA />` block between the templates teaser and the
 *     long-tail category chip rail is removed for the same reason.
 * Everything else (hero deck, metric trio, category showcase, featured 12,
 * templates teaser, bottom chip rail) matches the design we had before.
 */
export default function HomePage() {
  const cases = ALL_CASES;
  const templates = ALL_TEMPLATES;
  const animCases = useCountUp(cases.length, 900);
  // Hero deck — 5 floating cards, modelled on canghe's right-rail collage.
  const heroCases = useMemo(() => cases.slice(0, 5), [cases]);
  // Strip below the hero. Skip the 5 cases already in the deck so the
  // visuals don't repeat in the user's first viewport — show the next
  // batch of newest cases instead.
  const stripCases = useMemo(() => cases.slice(5, 19), [cases]);
  const featured = useMemo(() => cases.slice(0, 12), [cases]);
  const { ids: favoriteIds, toggle } = useFavorites();

  const recentCount = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 48 * 60 * 60 * 1000;
    return cases.reduce((n, c) => {
      const t = c.createdAt ? Date.parse(c.createdAt) : NaN;
      return Number.isFinite(t) && t >= cutoff && t <= now ? n + 1 : n;
    }, 0);
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

  const ldItemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "精选 GPT-Image 2 案例",
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

      <section className="container-narrow grid gap-8 pb-8 pt-7 sm:gap-10 sm:pb-12 sm:pt-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)] lg:items-center lg:pb-16">
        <div className="relative z-10 flex flex-col">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-ink-300 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-ember-400" />
            <span>
              {recentCount > 0
                ? `近 48h 新增 ${recentCount} 个案例`
                : "每周更新真实案例"}
            </span>
          </div>

          <h1 className="serif-display mt-4 max-w-3xl text-[2.35rem] leading-[0.98] text-ink-50 sm:text-[4.2rem] lg:text-[4.8rem]">
            GPT-Image 2
            <span className="block text-ember-300">中文案例库</span>
          </h1>

          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-300 sm:mt-6 sm:text-[17px]">
            爆款 AI 图片、现成 Prompt、按场景筛选。直接看图、复制、改词，少刷教程，多出结果。
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Link to="/cases" className="btn-primary justify-center">
              浏览全部 {animCases || cases.length} 个案例
              <ArrowRightIcon />
            </Link>
          </div>

          <div className="mt-6 grid max-w-md grid-cols-3 gap-2 text-center sm:mt-8">
            <Metric value={`${cases.length}+`} label="真实案例" />
            <Metric value={`${HOMEPAGE_USER_CATEGORIES.length}`} label="使用场景" />
            <Metric value={`${templates.length}`} label="工业模板" />
          </div>
        </div>

        <HeroDeck cases={heroCases} />
      </section>

      <HeroStrip cases={stripCases} />

      <CategoryShowcase cases={cases} />

      <section className="container-narrow scroll-mt-20 pt-10 sm:pt-14" id="featured">
        <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
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
            查看全部
          </Link>
        </div>
        <CaseGrid
          cases={featured}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggle}
          paginate={false}
        />
      </section>

      <section className="container-narrow scroll-mt-20 pt-4 sm:pt-10" id="templates-teaser">
        <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
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
            全部模板
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {templates.slice(0, 4).map((t) => (
            <TemplateCard key={t.id} data={t} />
          ))}
        </div>
      </section>

      <section className="container-narrow pb-16 pt-12 sm:pt-16">
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
    </>
  );
}

function HeroDeck({ cases }: { cases: PromptCase[] }) {
  if (cases.length === 0) {
    return <div className="h-[360px] rounded-2xl bg-ink-850 sm:h-[480px]" />;
  }

  // Pad the case list out to 5 — first paint is fine even if the data
  // pipeline somehow returned fewer items.
  const items: PromptCase[] = [];
  for (let i = 0; i < 5; i += 1) items.push(cases[i] ?? cases[cases.length - 1]);

  return (
    <div className="relative z-10">
      {/*
        Mobile / tablet: a single tall hero card. The 5-card floating deck
        looks great at desktop widths but collapses into a stacked mess
        below ~1024 px (the slots are absolutely positioned on a 34 rem
        canvas; even with transform-scale they overlap badly on a 360 px
        viewport). HeroStrip immediately below the hero already gives the
        user a "lots of cases" cue — the hero just needs one strong image.
      */}
      <div className="lg:hidden">
        <HeroSolo item={items[0]} />
      </div>

      {/* Desktop: the 5-card floating collage. */}
      <div className="hidden lg:block">
        <HeroFloatingDeck items={items} />
      </div>
    </div>
  );
}

/**
 * Single large hero card for mobile / tablet. No tilt, no drift — just a
 * cleanly framed 4:5 image with a soft caption strip.
 */
function HeroSolo({ item }: { item: PromptCase }) {
  return (
    <Link
      to={`/case/${item.slug}`}
      aria-label={item.title}
      className="
        group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl
        border border-white/[0.06] bg-ink-900/40
        shadow-[0_24px_60px_-22px_rgba(0,0,0,0.7)]
        transition active:scale-[0.99]
        sm:aspect-[5/4] sm:rounded-3xl
      "
    >
      <SmartImg
        src={item.imageUrl}
        alt={item.imageAlt || item.title}
        width={960}
        height={1200}
        widths={[480, 640, 960]}
        baseWidth={480}
        sizes="(min-width:640px) 70vw, 90vw"
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-[1.02]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink-950/85 via-ink-950/35 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <span className="mb-2 inline-flex rounded-full border border-white/15 bg-ink-950/65 px-2 py-0.5 text-[10.5px] font-medium text-ember-200 backdrop-blur">
          {item.ratio}
        </span>
        <strong className="line-clamp-2 text-[15px] font-semibold leading-tight text-ink-50 sm:text-[17px]">
          {item.title}
        </strong>
      </div>
    </Link>
  );
}

/**
 * Desktop-only collage: five absolutely-positioned cards with mild rotation
 * and a 7s vertical drift, modelled after gpt-image2.canghe.ai. The slot
 * canvas is 34 rem × 580 px; we never down-scale it because this branch
 * only renders at lg and above where there's plenty of room.
 */
function HeroFloatingDeck({ items }: { items: PromptCase[] }) {
  const slots: Array<{
    pos: string;
    size: string;
    tilt: string;
    delay: string;
    baseW: number;
    priority?: boolean;
  }> = [
    { pos: "left-[2.5rem] top-[1.5rem]",      size: "w-[16rem] h-[20rem]",        tilt: "-5deg", delay: "0s",    baseW: 480, priority: true },
    { pos: "right-[0.5rem] top-0",            size: "w-[14rem] h-[18rem]",        tilt: "4deg",  delay: "-1.2s", baseW: 480 },
    { pos: "left-0 top-[17rem]",              size: "w-[13rem] h-[14.5rem]",      tilt: "5deg",  delay: "-2.3s", baseW: 320 },
    { pos: "right-[1.5rem] top-[16.5rem]",    size: "w-[17.25rem] h-[15.25rem]",  tilt: "-3deg", delay: "-3.4s", baseW: 480 },
    { pos: "left-[10.5rem] top-[11rem]",      size: "w-[12.75rem] h-[15rem]",     tilt: "2deg",  delay: "-4.2s", baseW: 320 },
  ];

  return (
    <div className="relative mx-auto h-[580px] w-full max-w-[34rem]">
      <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(circle_at_45%_42%,rgba(217,119,87,0.12),transparent_42%),radial-gradient(circle_at_80%_72%,rgba(255,255,255,0.06),transparent_36%)] blur-2xl" />
      <div className="absolute inset-0">
        {items.map((item, i) => {
          const slot = slots[i];
          return (
            <HeroCard
              key={`${item.id}-${i}`}
              item={item}
              tilt={slot.tilt}
              delay={slot.delay}
              baseW={slot.baseW}
              priority={slot.priority}
              className={`${slot.pos} ${slot.size}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function HeroCard({
  item,
  tilt,
  delay,
  baseW,
  priority,
  className,
}: {
  item: PromptCase;
  tilt: string;
  delay: string;
  baseW: number;
  priority?: boolean;
  className: string;
}) {
  return (
    <Link
      to={`/case/${item.slug}`}
      aria-label={item.title}
      className={`hero-card group block ${className}`}
      style={
        {
          "--tilt": tilt,
          animationDelay: delay,
        } as React.CSSProperties
      }
    >
      <SmartImg
        src={item.imageUrl}
        alt={item.imageAlt || item.title}
        width={baseW * 2}
        height={Math.round(baseW * 2.5)}
        widths={[baseW, Math.min(baseW * 2, 960)]}
        baseWidth={baseW}
        sizes={`(min-width:1024px) ${baseW}px, ${Math.round(baseW * 0.75)}px`}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className="absolute inset-0 h-full w-full"
      />
      {/* Bottom gradient + caption: only the title, no IDs (per design feedback). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink-950/85 via-ink-950/35 to-transparent"
      />
      <strong className="absolute inset-x-3 bottom-3 line-clamp-2 text-[12.5px] font-semibold leading-tight text-ink-50">
        {item.title}
      </strong>
    </Link>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
      <strong className="stat-num block text-[22px] leading-none text-ink-50">{value}</strong>
      <span className="mt-1 block text-[11px] text-ink-400">{label}</span>
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
