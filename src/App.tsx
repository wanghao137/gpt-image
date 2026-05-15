import { useCallback, useEffect, useMemo, useState } from "react";
import type { PromptCase, PromptTemplate } from "./types";
import { Header } from "./components/Header";
import { FilterBar } from "./components/FilterBar";
import { CaseGrid } from "./components/CaseGrid";
import { CaseModal } from "./components/CaseModal";
import { useCopy } from "./hooks/useCopy";

const ALL = "全部";
const FAVORITES_KEY = "gpt-image-gallery:favorites:v1";

function uniqueOptions(items: string[][]) {
  return [ALL, ...Array.from(new Set(items.flat())).sort((a, b) => a.localeCompare(b))];
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

export default function App() {
  const [cases, setCases] = useState<PromptCase[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [style, setStyle] = useState(ALL);
  const [scene, setScene] = useState(ALL);
  const [active, setActive] = useState<PromptCase | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(readFavorites);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const { state: templateCopyState, copy: copyTemplate } = useCopy();

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
  const styles = useMemo(() => uniqueOptions(cases.map((item) => item.styles)), [cases]);
  const scenes = useMemo(() => uniqueOptions(cases.map((item) => item.scenes)), [cases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((item) => {
      const text = [item.id, item.title, item.category, item.prompt, item.promptPreview, item.source, ...item.tags, ...item.styles, ...item.scenes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const inCategory = category === ALL || item.category === category;
      const inStyle = style === ALL || item.styles.includes(style);
      const inScene = scene === ALL || item.scenes.includes(scene);
      const inQuery = !q || text.includes(q);
      return inCategory && inStyle && inScene && inQuery;
    });
  }, [cases, category, query, scene, style]);

  const favoriteCases = useMemo(() => cases.filter((item) => favoriteIds.has(item.id)), [cases, favoriteIds]);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openGenerate = useCallback((item: PromptCase) => {
    setActive(item);
  }, []);

  async function handleCopyTemplate(template: PromptTemplate) {
    await copyTemplate(template.prompt);
    setCopiedTemplateId(template.id);
    window.setTimeout(() => setCopiedTemplateId(null), 1600);
  }

  const heroCases = cases.slice(0, 5);

  return (
    <div id="top" className="min-h-full overflow-x-hidden bg-[#060914] text-slate-100">
      <Header caseCount={cases.length} templateCount={templates.length} />

      <main>
        <section className="relative isolate mx-auto grid max-w-7xl gap-10 px-4 pb-10 pt-12 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)] lg:px-8 lg:pb-16 lg:pt-16">
          <div className="heroGlow heroGlowA" />
          <div className="heroGlow heroGlowB" />
          <div className="scanGrid" />

          <div className="relative z-10 flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
              实时更新的 GPT-Image2 提示词画廊
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl">
              从爆款图片，到可复用 Prompt。
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              一个面向 GPT-Image2 创作的可视化工作台：浏览真实案例、复制 Prompt、查看工业级模板，并保留后续接入在线测试生图的入口。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#gallery" className="rounded-2xl bg-cyan-200 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-cyan-300/25 transition hover:bg-white">
                浏览案例
              </a>
              <a href="#templates" className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black text-white transition hover:border-cyan-200/50 hover:bg-cyan-300/10">
                查看模板
              </a>
            </div>
            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <strong className="block text-2xl font-black text-white">{cases.length}</strong>
                <span className="text-xs font-bold text-slate-400">个案例</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <strong className="block text-2xl font-black text-white">{Math.max(categories.length - 1, 0)}</strong>
                <span className="text-xs font-bold text-slate-400">个分类</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <strong className="block text-2xl font-black text-white">{templates.length}</strong>
                <span className="text-xs font-bold text-slate-400">套模板</span>
              </div>
            </div>
            {loading && <p className="mt-4 text-sm font-bold text-cyan-100">正在加载本地同步数据...</p>}
            {loadError && <p className="mt-4 text-sm font-bold text-rose-200">数据加载失败：{loadError}</p>}
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-3 sm:gap-4">
            {heroCases.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item)}
                className={
                  "heroCard group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] text-left shadow-2xl shadow-slate-950/30 transition hover:-translate-y-1 hover:border-cyan-200/40 " +
                  (index === 0 ? "col-span-2" : "")
                }
              >
                <img src={item.imageUrl} alt={item.imageAlt || item.title} className="h-48 w-full object-cover opacity-85 transition duration-700 group-hover:scale-105 group-hover:opacity-100 sm:h-56" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-4">
                  <span className="text-xs font-black text-cyan-100">案例 {item.id}</span>
                  <strong className="mt-1 block text-sm font-black text-white sm:text-base">{item.title}</strong>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section id="gallery" className="scroll-mt-24">
          <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/70">复制、筛选、复用</p>
                <h2 className="mt-2 text-3xl font-black text-white">爆款案例和 Prompt，一键可取。</h2>
              </div>
              <a href="https://github.com/freestylefly/awesome-gpt-image-2" target="_blank" rel="noreferrer" className="text-sm font-black text-cyan-100 transition hover:text-white">
                打开 GitHub 项目
              </a>
            </div>
          </div>
          <FilterBar
            query={query}
            onQueryChange={setQuery}
            categories={categories}
            activeCategory={category}
            onCategoryChange={setCategory}
            styles={styles}
            activeStyle={style}
            onStyleChange={setStyle}
            scenes={scenes}
            activeScene={scene}
            onSceneChange={setScene}
            total={cases.length}
            matched={filtered.length}
          />
          <CaseGrid cases={filtered} favoriteIds={favoriteIds} onSelect={setActive} onToggleFavorite={toggleFavorite} onGenerate={openGenerate} />
        </section>

        {favoriteCases.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-pink-300/20 bg-pink-300/[0.06] p-5">
              <h2 className="text-lg font-black text-white">我的收藏</h2>
              <p className="mt-1 text-sm text-slate-400">已保存到本浏览器，可随时取消收藏。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {favoriteCases.map((item) => (
                  <button key={item.id} type="button" onClick={() => setActive(item)} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-200 transition hover:border-pink-200/60 hover:text-white">
                    #{item.id} {item.title}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="templates" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mb-6 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/70">工业级提示词模板</p>
            <h2 className="mt-2 text-3xl font-black text-white">先用成熟模板起稿，再从案例库里继续 remix。</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">每套模板都提炼为结构化 Prompt，适合直接复制后替换主体、场景、品牌和限制条件。</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {templates.map((template) => {
              const copied = copiedTemplateId === template.id;
              const label = copied && templateCopyState === "copied" ? "已复制" : copied && templateCopyState === "error" ? "复制失败" : "复制模板";
              return (
                <article key={template.id} className="overflow-hidden rounded-3xl border border-white/10 bg-[#090f20]/85 shadow-2xl shadow-slate-950/30">
                  <img src={template.cover} alt={template.title} loading="lazy" className="h-40 w-full object-cover opacity-90" />
                  <div className="space-y-3 p-4">
                    <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] font-black text-cyan-100">{template.category}</span>
                    <h3 className="text-lg font-black text-white">{template.title}</h3>
                    <p className="text-sm leading-6 text-slate-400">{template.description}</p>
                    <p className="text-xs font-bold text-slate-500">适用场景：{template.useWhen}</p>
                    <button type="button" onClick={() => void handleCopyTemplate(template)} className="w-full rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20">
                      {label}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="agent-skill" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-5 rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl shadow-slate-950/30 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/70">Agent Skill</p>
              <h2 className="mt-2 text-3xl font-black text-white">把 GPT-Image2 风格库装进 Claude Code 和 Codex。</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">静态版先保留技能入口和示例请求，后续可接入同源模板库与自动同步。</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">安装到本地 Agent</p>
              <code className="mt-3 block overflow-x-auto rounded-xl bg-black/50 p-4 text-xs font-bold leading-6 text-cyan-100">
                npx skills add freestylefly/awesome-gpt-image-2 --skill gpt-image-2-style-library --agent claude-code codex --global --yes --copy
              </code>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">试试这个请求</p>
              <code className="mt-3 block rounded-xl bg-black/50 p-4 text-xs font-bold leading-6 text-emerald-100">
                用 gpt-image-2-style-library 技能生成城市生命系统图谱
              </code>
            </div>
          </div>
        </section>
      </main>

      <CaseModal data={active} favorited={active ? favoriteIds.has(active.id) : false} onClose={() => setActive(null)} onToggleFavorite={toggleFavorite} />

      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs font-bold text-slate-500">
        GPT-Image2 Prompt Gallery · 静态前端对标版 · 数据由 npm run sync 同步生成
      </footer>
    </div>
  );
}
