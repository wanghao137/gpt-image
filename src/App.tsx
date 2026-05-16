import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import type { PromptCase, PromptTemplate } from "./types";
import { Header } from "./components/Header";
import { FilterBar } from "./components/FilterBar";
import { CaseGrid } from "./components/CaseGrid";
import { TemplateCard } from "./components/TemplateCard";
import { BackToTop } from "./components/BackToTop";
import { CategoryShowcase } from "./components/CategoryShowcase";
import { useCopy } from "./hooks/useCopy";
import { useCountUp } from "./hooks/useCountUp";
import { useReveal } from "./hooks/useReveal";

const CaseModal = lazy(() =>
  import("./components/CaseModal").then((m) => ({ default: m.CaseModal })),
);

const ALL = "全部";
const FAVORITES_KEY = "gpt-image-gallery:favorites:v1";

function uniqueOptions(items: string[][]) {
  return [
    ALL,
    ...Array.from(new Set(items.flat())).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
  ];
}

function readFavorites() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(parsed);
  } catch {
    return new Set<string>();
  }
}

async function fetchData<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`);
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<T>;
}

const SKILL_CMD =
  "npx skills add freestylefly/awesome-gpt-image-2 --skill gpt-image-2-style-library --agent claude-code codex --global --yes --copy";
const SKILL_REQUEST = "Use gpt-image-2-style-library to create a city life system map.";

/** Detect whether the user is on a narrow viewport without re-rendering on resize. */
function isNarrowViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

/** Detect Save-Data / slow connection — used to dial down heavy effects. */
function shouldRespectSaveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  return Boolean(c?.saveData) || c?.effectiveType === "slow-2g" || c?.effectiveType === "2g";
}

export default function App() {
  const [cases, setCases] = useState<PromptCase[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [styleFilter, setStyleFilter] = useState(ALL);
  const [scene, setScene] = useState(ALL);
  const [active, setActive] = useState<PromptCase | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(readFavorites);
  const [showFavorites, setShowFavorites] = useState(false);
  const [narrow] = useState<boolean>(isNarrowViewport);
  const [saveData] = useState<boolean>(shouldRespectSaveData);

  const cmdCopy = useCopy(1800);
  const reqCopy = useCopy(1800);

  const animCases = useCountUp(cases.length, 1100);
  const animTemplates = useCountUp(templates.length, 900);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchData<PromptCase[]>("/data/cases.json"),
      fetchData<PromptTemplate[]>("/data/templates.json"),
    ])
      .then(([nextCases, nextTemplates]) => {
        if (cancelled) return;
        setCases(nextCases);
        setTemplates(nextTemplates);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "数据加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favoriteIds)));
  }, [favoriteIds]);

  const categories = useMemo(() => uniqueOptions(cases.map((item) => [item.category])), [cases]);
  const styleOptions = useMemo(() => uniqueOptions(cases.map((item) => item.styles)), [cases]);
  const scenes = useMemo(() => uniqueOptions(cases.map((item) => item.scenes)), [cases]);

  const baseList = useMemo(() => {
    if (showFavorites) return cases.filter((item) => favoriteIds.has(item.id));
    return cases;
  }, [cases, favoriteIds, showFavorites]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseList.filter((item) => {
      const inCategory = category === ALL || item.category === category;
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

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const heroCases = useMemo(() => cases.slice(0, 7), [cases]);
  const tickerCases = useMemo(() => cases.slice(0, 18), [cases]);
  const showTicker = !narrow && !saveData && tickerCases.length > 6;

  const favoriteCount = favoriteIds.size;

  // Once the first hero image URL is known, ask the browser to preload it as the LCP candidate.
  useEffect(() => {
    if (!cases[0]?.imageUrl) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = cases[0].imageUrl;
    link.fetchPriority = "high";
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [cases]);

  useReveal([cases.length, templates.length, filtered.length, showFavorites]);

  return (
    <div id="top" className="min-h-full overflow-x-hidden font-sans text-ink-100">
      <Header caseCount={cases.length} templateCount={templates.length} />

      <main>
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
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-300 backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember-500" />
                </span>
                Live · GPT-Image 2 Prompt Gallery
              </div>

              <h1 className="serif-display text-[2.2rem] leading-[1.05] text-ink-50 sm:text-5xl lg:text-[4.4rem] lg:leading-[1.02]">
                从爆款图片，
                <br />
                到可复用{" "}
                <em className="not-italic">
                  <span className="bg-gradient-to-br from-ember-200 via-ember-400 to-ember-600 bg-clip-text text-transparent">
                    Prompt
                  </span>
                  <span className="ml-0.5 text-ember-400">.</span>
                </em>
              </h1>

              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-300 sm:mt-6 sm:text-[17px]">
                一个面向 GPT-Image 2 创作者的可视化工作台。浏览真实案例、复制 Prompt、查看工业级模板，
                把灵感到出图的距离压到最短。
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
                <a href="#gallery" className="btn-primary">
                  浏览案例
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
                <a href="#templates" className="btn-ghost">
                  查看模板
                </a>
              </div>

              <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-white/[0.06] pt-7 sm:mt-12 sm:pt-8">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">
                    案例
                  </dt>
                  <dd className="stat-num mt-1 text-[28px] leading-none text-ink-50 sm:text-4xl">
                    {animCases || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">
                    分类
                  </dt>
                  <dd className="stat-num mt-1 text-[28px] leading-none text-ink-50 sm:text-4xl">
                    {Math.max(categories.length - 1, 0) || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">
                    模板
                  </dt>
                  <dd className="stat-num mt-1 text-[28px] leading-none text-ink-50 sm:text-4xl">
                    {animTemplates || "—"}
                  </dd>
                </div>
              </dl>

              {loadError && (
                <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] font-medium text-rose-200">
                  数据加载失败：{loadError}
                </p>
              )}
            </div>

            {/* Hero collage —
                MOBILE: single LCP card.
                DESKTOP: 3x3 magazine grid. */}
            <div className="relative z-10">
              {heroCases.length === 0 ? (
                <div className="aspect-[4/5] animate-pulse rounded-2xl bg-gradient-to-br from-ink-850 to-ink-800 sm:aspect-[16/10] lg:aspect-square" />
              ) : (
                <>
                  {/* Mobile: single hero image */}
                  <button
                    type="button"
                    onClick={() => setActive(heroCases[0])}
                    className="group relative block w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40 text-left lg:hidden"
                    aria-label={heroCases[0].title}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden">
                      <img
                        src={heroCases[0].imageUrl}
                        alt={heroCases[0].imageAlt || heroCases[0].title}
                        width={800}
                        height={1000}
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <span className="text-[10.5px] font-medium tracking-[0.18em] text-ember-300">
                          CASE #{heroCases[0].id}
                        </span>
                        <strong className="mt-1 line-clamp-1 block text-[15px] font-semibold text-ink-50">
                          {heroCases[0].title}
                        </strong>
                      </div>
                    </div>
                  </button>

                  {/* Mobile: 2-up thumbnails (only render if we have data) */}
                  {heroCases.length > 1 && (
                    <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:hidden">
                      {heroCases.slice(1, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActive(item)}
                          className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-ink-900/40 text-left"
                          aria-label={item.title}
                        >
                          <div className="relative aspect-[4/5] overflow-hidden">
                            <img
                              src={item.imageUrl}
                              alt=""
                              width={400}
                              height={500}
                              loading="lazy"
                              decoding="async"
                              className="absolute inset-0 h-full w-full object-cover opacity-90"
                            />
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950 to-transparent" />
                            <span className="absolute bottom-2 left-2 right-2 line-clamp-1 text-[11px] font-medium text-ink-100">
                              #{item.id} · {item.title}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Desktop: 3x3 magazine grid */}
                  <div className="hidden grid-cols-3 grid-rows-3 gap-3 lg:grid">
                    {heroCases.slice(0, 5).map((item, index) => {
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
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActive(item)}
                          className={
                            "group card-spotlight relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40 text-left transition duration-700 hover:-translate-y-1 hover:border-white/20 hover:shadow-soft " +
                            layout
                          }
                          onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            e.currentTarget.style.setProperty(
                              "--x",
                              `${e.clientX - rect.left}px`,
                            );
                            e.currentTarget.style.setProperty(
                              "--y",
                              `${e.clientY - rect.top}px`,
                            );
                          }}
                          style={{ animation: `fadeUp 0.6s ${index * 80}ms ease-out both` }}
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.imageAlt || item.title}
                            width={index === 0 ? 1000 : 500}
                            height={index === 0 ? 1000 : 500}
                            loading={index === 0 ? "eager" : "lazy"}
                            fetchPriority={index === 0 ? "high" : "auto"}
                            decoding="async"
                            className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-[1500ms] group-hover:scale-[1.06] group-hover:opacity-100"
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 p-3">
                            <span className="text-[10.5px] font-medium tracking-[0.18em] text-ember-300">
                              CASE #{item.id}
                            </span>
                            <strong className="mt-1 line-clamp-1 block text-[13px] font-semibold text-ink-50">
                              {item.title}
                            </strong>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Cinematic ticker — desktop only, paused while offscreen */}
          {showTicker && (
            <div className="ticker-wrap relative overflow-hidden border-y border-white/[0.05] bg-white/[0.015] py-6">
              <div className="mask-fade-x">
                <div className="marquee">
                  {[...tickerCases, ...tickerCases].map((item, idx) => (
                    <button
                      key={`${item.id}-${idx}`}
                      type="button"
                      onClick={() => setActive(item)}
                      className="group relative h-32 w-48 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-ink-900/40 text-left transition hover:border-white/[0.18]"
                      aria-label={item.title}
                    >
                      <img
                        src={item.imageUrl}
                        alt=""
                        width={384}
                        height={256}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-110 group-hover:opacity-100"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950 to-transparent" />
                      <span className="absolute bottom-2 left-2 right-2 line-clamp-1 text-[11px] font-medium text-ink-100">
                        #{item.id} · {item.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* CATEGORY SHOWCASE */}
        {cases.length > 0 && (
          <div className="reveal">
            <CategoryShowcase
              cases={cases}
              activeCategory={category}
              onCategoryChange={setCategory}
            />
          </div>
        )}

        {/* GALLERY */}
        <section id="gallery" className="scroll-mt-20">
          <div className="container-narrow pt-6">
            <div className="reveal flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Copy · Filter · Remix</p>
                <h2 className="serif-display mt-2 text-[26px] text-ink-50 sm:text-4xl lg:text-[44px]">
                  爆款案例和 Prompt，一键可取。
                </h2>
              </div>
              <div className="flex items-center gap-2">
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
                  aria-pressed={showFavorites}
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
            </div>
          </div>

          <FilterBar
            query={query}
            onQueryChange={setQuery}
            categories={categories}
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
            onSelect={setActive}
            onToggleFavorite={toggleFavorite}
            loading={loading}
            onResetFilters={resetFilters}
          />
        </section>

        {/* TEMPLATES */}
        <section id="templates" className="scroll-mt-20">
          <div className="container-narrow pb-20">
            <div className="reveal mb-8 max-w-2xl sm:mb-10">
              <p className="eyebrow">Industrial Templates</p>
              <h2 className="serif-display mt-2 text-[26px] text-ink-50 sm:text-4xl lg:text-[44px]">
                先用成熟模板起稿，再用案例库 remix。
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-400 sm:text-[15px]">
                每套模板都从真实案例中提炼，包含结构、约束与防坑指南，适合直接复制后替换主体、场景、品牌和限制条件。
              </p>
            </div>

            {loading && templates.length === 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40"
                  >
                    <div className="aspect-[16/10] animate-pulse bg-gradient-to-br from-ink-850 to-ink-800" />
                    <div className="space-y-3 p-5">
                      <div className="h-3 w-1/3 animate-pulse rounded bg-ink-800" />
                      <div className="h-4 w-3/4 animate-pulse rounded bg-ink-800" />
                      <div className="h-3 w-full animate-pulse rounded bg-ink-800" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="reveal grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {templates.map((template) => (
                  <TemplateCard key={template.id} data={template} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* AGENT SKILL */}
        <section id="agent-skill" className="scroll-mt-20">
          <div className="container-narrow pb-24">
            <div className="reveal surface relative overflow-hidden p-5 sm:p-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-ember-500/10 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-ember-700/10 blur-3xl"
              />

              <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
                <div>
                  <p className="eyebrow">Agent Skill</p>
                  <h2 className="serif-display mt-2 text-[26px] leading-[1.1] text-ink-50 sm:text-4xl">
                    把 GPT-Image 2 风格库装进 Claude Code 与 Codex。
                  </h2>
                  <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink-400 sm:text-[15px]">
                    一条命令完成安装，让你的本地 Agent 直接调用与本站同源的模板、风格、场景与防坑指南。
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
                    <span className="chip chip-idle">Claude Code ready</span>
                    <span className="chip chip-idle">Codex ready</span>
                    <span className="chip chip-idle">{templates.length}+ 模板</span>
                  </div>
                  <a
                    href="https://github.com/freestylefly/awesome-gpt-image-2/tree/main/agents/skills/gpt-image-2-style-library"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-ember-300 transition hover:text-ember-200 sm:mt-8"
                  >
                    查看技能源码
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path d="M11 3a1 1 0 1 0 0 2h2.59l-6.3 6.29a1 1 0 0 0 1.42 1.42L15 6.41V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
                      <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
                    </svg>
                  </a>
                </div>

                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-950/70">
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
                        <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
                        <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
                        <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">
                          install · terminal
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => cmdCopy.copy(SKILL_CMD)}
                        className="text-[11px] font-medium text-ink-400 transition hover:text-ink-50"
                      >
                        {cmdCopy.state === "copied" ? "已复制" : "复制"}
                      </button>
                    </div>
                    <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-ember-100 scrollbar-thin">
                      <code>
                        <span className="text-ink-500">$ </span>
                        {SKILL_CMD}
                      </code>
                    </pre>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between">
                      <p className="eyebrow">Try this request</p>
                      <button
                        type="button"
                        onClick={() => reqCopy.copy(SKILL_REQUEST)}
                        className="text-[11px] font-medium text-ink-400 transition hover:text-ink-50"
                      >
                        {reqCopy.state === "copied" ? "已复制" : "复制"}
                      </button>
                    </div>
                    <p className="mt-2 break-all font-mono text-[13px] leading-relaxed text-ink-100">
                      {SKILL_REQUEST}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {active && (
        <Suspense fallback={null}>
          <CaseModal
            data={active}
            favorited={favoriteIds.has(active.id)}
            onClose={() => setActive(null)}
            onToggleFavorite={toggleFavorite}
          />
        </Suspense>
      )}

      <BackToTop />

      <footer className="border-t border-white/[0.06]">
        <div
          className="container-narrow flex flex-col items-center justify-between gap-3 py-8 text-[12px] text-ink-500 sm:flex-row"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
          <p>
            GPT-Image 2 Prompt Gallery · 数据由{" "}
            <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-ink-300">
              npm run sync
            </code>{" "}
            生成
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/freestylefly/awesome-gpt-image-2"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-ink-100"
            >
              数据源
            </a>
            <span className="text-ink-700">·</span>
            <a
              href="https://gpt-image2.canghe.ai"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-ink-100"
            >
              对标站
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
