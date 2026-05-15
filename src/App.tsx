import { useCallback, useEffect, useMemo, useState } from "react";
import type { PromptCase, PromptTemplate } from "./types";
import { Header } from "./components/Header";
import { FilterBar } from "./components/FilterBar";
import { CaseGrid } from "./components/CaseGrid";
import { CaseModal } from "./components/CaseModal";
import { TemplateCard } from "./components/TemplateCard";
import { BackToTop } from "./components/BackToTop";
import { useCopy } from "./hooks/useCopy";

const ALL = "全部";
const FAVORITES_KEY = "gpt-image-gallery:favorites:v1";

function uniqueOptions(items: string[][]) {
  return [ALL, ...Array.from(new Set(items.flat())).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))];
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

  const cmdCopy = useCopy(1800);
  const reqCopy = useCopy(1800);

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
        item.prompt,
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

  const heroCases = cases.slice(0, 5);
  const favoriteCount = favoriteIds.size;

  return (
    <div id="top" className="min-h-full overflow-x-hidden font-sans text-ink-100">
      <Header caseCount={cases.length} templateCount={templates.length} />

      <main>
        {/* HERO */}
        <section className="relative isolate">
          <div className="container-narrow grid gap-12 pb-16 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)] lg:gap-16 lg:pb-24 lg:pt-24">
            <div className="relative z-10 flex flex-col justify-center animate-fade-up">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember-500" />
                </span>
                Live · GPT-Image 2 Prompt Gallery
              </div>

              <h1 className="serif-display text-[2.6rem] leading-[1.05] text-ink-50 sm:text-6xl lg:text-[4.2rem]">
                从爆款图片，
                <br />
                到可复用 <em className="not-italic text-ember-400">Prompt</em>。
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-300 sm:text-[17px]">
                一个面向 GPT-Image 2 创作者的可视化工作台。浏览真实案例、复制 Prompt、查看工业级模板，
                把灵感到出图的距离压到最短。
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
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

              <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-white/[0.06] pt-8">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">案例</dt>
                  <dd className="serif-display mt-1 text-3xl text-ink-50">
                    {cases.length || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">分类</dt>
                  <dd className="serif-display mt-1 text-3xl text-ink-50">
                    {Math.max(categories.length - 1, 0) || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">模板</dt>
                  <dd className="serif-display mt-1 text-3xl text-ink-50">
                    {templates.length || "—"}
                  </dd>
                </div>
              </dl>

              {loadError && (
                <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] font-medium text-rose-200">
                  数据加载失败：{loadError}
                </p>
              )}
            </div>

            {/* Hero collage */}
            <div className="relative z-10 grid grid-cols-2 gap-3 sm:gap-4">
              {heroCases.length === 0
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={
                        "aspect-[4/5] animate-pulse rounded-2xl bg-gradient-to-br from-ink-850 to-ink-800 " +
                        (i === 0 ? "col-span-2 aspect-[16/10]" : "")
                      }
                    />
                  ))
                : heroCases.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActive(item)}
                      className={
                        "group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40 text-left transition duration-500 hover:-translate-y-1 hover:border-white/20 hover:shadow-soft " +
                        (index === 0 ? "col-span-2" : "")
                      }
                      style={{ animation: `fadeUp 0.6s ${index * 80}ms ease-out both` }}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.imageAlt || item.title}
                        loading={index === 0 ? "eager" : "lazy"}
                        decoding="async"
                        className={
                          "w-full object-cover opacity-90 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-100 " +
                          (index === 0 ? "aspect-[16/10]" : "aspect-[4/5]")
                        }
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
                  ))}
            </div>
          </div>
        </section>

        {/* GALLERY */}
        <section id="gallery" className="scroll-mt-20">
          <div className="container-narrow pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Copy · Filter · Remix</p>
                <h2 className="serif-display mt-2 text-3xl text-ink-50 sm:text-4xl">
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
            <div className="mb-10 max-w-2xl">
              <p className="eyebrow">Industrial Templates</p>
              <h2 className="serif-display mt-2 text-3xl text-ink-50 sm:text-4xl">
                先用成熟模板起稿，再用案例库 remix。
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-400">
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
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
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
            <div className="surface relative overflow-hidden p-6 sm:p-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-ember-500/10 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-ember-700/10 blur-3xl"
              />

              <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
                <div>
                  <p className="eyebrow">Agent Skill</p>
                  <h2 className="serif-display mt-2 text-3xl leading-[1.1] text-ink-50 sm:text-4xl">
                    把 GPT-Image 2 风格库装进 Claude Code 与 Codex。
                  </h2>
                  <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-400">
                    一条命令完成安装，让你的本地 Agent 直接调用与本站同源的模板、风格、场景与防坑指南。
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className="chip chip-idle">Claude Code ready</span>
                    <span className="chip chip-idle">Codex ready</span>
                    <span className="chip chip-idle">{templates.length}+ 模板</span>
                  </div>
                  <a
                    href="https://github.com/freestylefly/awesome-gpt-image-2/tree/main/agents/skills/gpt-image-2-style-library"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-ember-300 transition hover:text-ember-200"
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
                    <p className="mt-2 font-mono text-[13px] leading-relaxed text-ink-100">
                      {SKILL_REQUEST}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <CaseModal
        data={active}
        favorited={active ? favoriteIds.has(active.id) : false}
        onClose={() => setActive(null)}
        onToggleFavorite={toggleFavorite}
      />

      <BackToTop />

      <footer className="border-t border-white/[0.06]">
        <div className="container-narrow flex flex-col items-center justify-between gap-3 py-8 text-[12px] text-ink-500 sm:flex-row">
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
