import { useMemo, useState } from "react";
import { ALL_TEMPLATES } from "../lib/data";
import { sortTemplatesForDisplay } from "../lib/templateSort";
import {
  filterAndSortTemplates,
  templateCategories,
  type TemplateSortMode,
} from "../lib/template-discovery.mjs";
import { TemplateCard } from "../components/TemplateCard";
import { SEO } from "../components/SEO";
import { BRAND } from "../lib/brand";

export default function TemplatesPage() {
  const templates = sortTemplatesForDisplay(ALL_TEMPLATES);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<TemplateSortMode>("curated");
  const categories = useMemo(() => templateCategories(templates), [templates]);
  const visibleTemplates = useMemo(
    () => filterAndSortTemplates(templates, { query, category, sort }),
    [category, query, sort, templates],
  );
  const hasFilters = query.trim().length > 0 || category.length > 0;

  const reset = () => {
    setQuery("");
    setCategory("");
    setSort("curated");
  };

  return (
    <>
      <SEO
        title={`${templates.length} 套 GPT-Image 2 工业级模板`}
        description={`${BRAND.name}按用途分组整理 GPT-Image 2 工业级 Prompt 模板：UI 截图 / 信息图 / 海报 / 产品 / 品牌 / 摄影 / 角色 / 场景叙事。复制即可用，含约束与防坑指南。`}
        path="/templates"
      />
      <section className="container-narrow pt-10 sm:pt-14">
        <p className="eyebrow">Industrial Templates</p>
        <h1 className="serif-display mt-2 text-[28px] text-ink-50 sm:text-4xl lg:text-[44px]">
          {templates.length} 套工业级模板，先起稿再 remix
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-400 sm:text-[15px]">
          每套模板都从真实案例中提炼，包含结构、约束与防坑指南，适合直接复制后替换主体、场景、品牌和限制条件。
        </p>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-ink-500 sm:text-[13px]">
          模板由本项目基于合并案例库自动派生，并辅以手动维护的精选模板。
        </p>
      </section>

      <section className="container-narrow pt-7" aria-label="筛选模板">
        <div className="rounded-2xl border border-white/[0.07] bg-ink-900/55 p-3 sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_180px]">
            <div>
              <label htmlFor="template-search" className="sr-only">
                搜索模板
              </label>
              <div className="relative">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  id="template-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索用途、风格或模板名称"
                  className="h-11 w-full rounded-xl border border-white/10 bg-ink-950/55 pl-10 pr-4 text-[13px] text-ink-100 outline-none transition placeholder:text-ink-600 focus:border-ember-400/55 focus:ring-2 focus:ring-ember-400/15"
                />
              </div>
            </div>
            <label className="sr-only" htmlFor="template-category">
              模板分类
            </label>
            <select
              id="template-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-ink-950/55 px-3 text-[13px] text-ink-200 outline-none transition focus:border-ember-400/55 focus:ring-2 focus:ring-ember-400/15"
            >
              <option value="">全部分类 · {templates.length}</option>
              {categories.map((item) => (
                <option key={item.label} value={item.label}>
                  {item.label} · {item.count}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="template-sort">
              模板排序
            </label>
            <select
              id="template-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as TemplateSortMode)}
              className="h-11 rounded-xl border border-white/10 bg-ink-950/55 px-3 text-[13px] text-ink-200 outline-none transition focus:border-ember-400/55 focus:ring-2 focus:ring-ember-400/15"
            >
              <option value="curated">推荐排序</option>
              <option value="newest">最新优先</option>
              <option value="title">名称排序</option>
            </select>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
            <p className="text-[12.5px] text-ink-400" aria-live="polite" aria-atomic="true">
              找到 <strong className="font-semibold text-ink-100">{visibleTemplates.length}</strong> 套模板
              {category ? ` · ${category}` : ""}
            </p>
            {(hasFilters || sort !== "curated") && (
              <button
                type="button"
                onClick={reset}
                className="text-[12.5px] font-medium text-ember-300 transition hover:text-ember-200"
              >
                清除筛选
              </button>
            )}
          </div>
        </div>
      </section>

      {visibleTemplates.length > 0 ? (
        <div className="container-narrow grid gap-5 pb-16 pt-6 sm:grid-cols-2 xl:grid-cols-4">
          {visibleTemplates.map((t) => (
            <TemplateCard key={t.id} data={t} expandable />
          ))}
        </div>
      ) : (
        <div className="container-narrow pb-20 pt-8">
          <div className="rounded-2xl border border-dashed border-white/10 bg-ink-900/35 px-5 py-12 text-center">
            <h2 className="text-[17px] font-semibold text-ink-100">没有匹配的模板</h2>
            <p className="mt-2 text-[13px] text-ink-400">换一个关键词，或清除分类后再试。</p>
            <button type="button" onClick={reset} className="btn-ghost mt-5">
              查看全部模板
            </button>
          </div>
        </div>
      )}
    </>
  );
}
