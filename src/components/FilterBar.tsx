import { useEffect, useMemo, useRef, useState } from "react";
import { sceneLabel, styleLabel } from "../lib/labels";

interface FilterBarProps {
  query: string;
  onQueryChange: (v: string) => void;
  categories: string[];
  activeCategory: string;
  onCategoryChange: (c: string) => void;
  styles: string[];
  activeStyle: string;
  onStyleChange: (v: string) => void;
  scenes: string[];
  activeScene: string;
  onSceneChange: (v: string) => void;
  total: number;
  matched: number;
  hasActiveFilter: boolean;
  onReset: () => void;
}

interface SelectProps {
  label: string;
  value: string;
  options: string[];
  /** Optional translator for option display. Underlying values are unchanged. */
  format?: (raw: string) => string;
  onChange: (v: string) => void;
}

const ALL = "全部";

function Select({ label, value, options, onChange, format }: SelectProps) {
  return (
    <label className="group relative flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="peer w-full appearance-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 pr-10 text-sm font-medium text-ink-100 outline-none transition hover:border-white/25 focus:border-ember-500/60 focus:ring-2 focus:ring-ember-500/20"
        >
          {options.map((option) => (
            <option key={option} value={option} className="bg-ink-900 text-ink-100">
              {format ? format(option) : option}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition group-hover:text-ink-200"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </label>
  );
}

export function FilterBar({
  query,
  onQueryChange,
  categories,
  activeCategory,
  onCategoryChange,
  styles,
  activeStyle,
  onStyleChange,
  scenes,
  activeScene,
  onSceneChange,
  total,
  matched,
  hasActiveFilter,
  onReset,
}: FilterBarProps) {
  const [draft, setDraft] = useState(query);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => onQueryChange(draft), 200);
    return () => window.clearTimeout(t);
  }, [draft, onQueryChange]);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && drawerOpen) setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const matchLabel = useMemo(() => {
    if (matched === total) return `${total} 个案例`;
    return `${matched} / ${total} 匹配`;
  }, [matched, total]);

  const activeCount =
    (activeCategory !== ALL ? 1 : 0) + (activeStyle !== ALL ? 1 : 0) + (activeScene !== ALL ? 1 : 0);

  return (
    <div className="container-narrow pb-6 pt-4">
      <div className="surface p-3 sm:p-5">
        {/* Row 1: search + (mobile) filter button + match count */}
        <div className="flex items-center gap-2 sm:hidden">
          <div className="relative flex-1">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 3.4 9.84l3.13 3.13a.75.75 0 1 0 1.06-1.06l-3.13-3.13A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <input
              ref={inputRef}
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="搜索 Prompt"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm font-medium text-ink-100 outline-none transition placeholder:text-ink-500 hover:border-white/25 focus:border-ember-500/60 focus:ring-2 focus:ring-ember-500/20"
              aria-label="搜索案例"
            />
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm font-medium text-ink-100 transition hover:border-white/25"
            aria-label="筛选"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M6 12h12" />
              <path d="M10 18h4" />
            </svg>
            筛选
            {activeCount > 0 && (
              <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-ember-500 px-1.5 text-[11px] font-semibold tabular-nums text-ink-950">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-[12px] sm:hidden">
          <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-medium tabular-nums text-ink-200">
            {matchLabel}
          </span>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={onReset}
              className="text-[12px] font-medium text-ink-300 transition hover:text-ink-50"
            >
              清除筛选
            </button>
          )}
        </div>

        {/* Desktop layout (>= sm): inline grid as before */}
        <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
          <div className="flex flex-col gap-1.5 lg:col-span-1">
            <span className="eyebrow">搜索</span>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 1 0 3.4 9.84l3.13 3.13a.75.75 0 1 0 1.06-1.06l-3.13-3.13A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <input
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="搜索标题、Prompt、来源..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-16 text-sm font-medium text-ink-100 outline-none transition placeholder:text-ink-500 hover:border-white/25 focus:border-ember-500/60 focus:ring-2 focus:ring-ember-500/20"
                aria-label="搜索案例"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-ink-400 lg:inline-block">
                ⌘K
              </kbd>
            </div>
          </div>

          <Select
            label="分类"
            value={activeCategory}
            options={categories}
            onChange={onCategoryChange}
          />
          <Select
            label="风格"
            value={activeStyle}
            options={styles}
            format={styleLabel}
            onChange={onStyleChange}
          />
          <Select
            label="场景"
            value={activeScene}
            options={scenes}
            format={sceneLabel}
            onChange={onSceneChange}
          />

          <div className="flex items-center gap-2 lg:justify-end">
            <span className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] font-medium tabular-nums text-ink-200">
              {matchLabel}
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={onReset}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] font-medium text-ink-300 transition hover:border-white/25 hover:text-ink-50"
                aria-label="重置筛选"
              >
                清除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="筛选条件"
          className="fixed inset-0 z-50 flex items-end sm:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-md animate-fade-in" />
          <div
            className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-3xl border-t border-white/10 bg-ink-900 p-5"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="serif-display text-2xl text-ink-50">筛选条件</h3>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="关闭"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ink-300 hover:text-ink-50"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="grid gap-4 overflow-auto">
              <Select
                label="分类"
                value={activeCategory}
                options={categories}
                onChange={onCategoryChange}
              />
              <Select
                label="风格"
                value={activeStyle}
                options={styles}
                format={styleLabel}
                onChange={onStyleChange}
              />
              <Select
                label="场景"
                value={activeScene}
                options={scenes}
                format={sceneLabel}
                onChange={onSceneChange}
              />
            </div>
            <div className="mt-5 flex gap-2">
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={onReset}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] font-medium text-ink-200"
                >
                  重置
                </button>
              )}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex-1 rounded-xl bg-ember-500 px-4 py-3 text-[14px] font-semibold text-ink-950 transition hover:bg-ember-400"
              >
                查看 {matched} 个结果
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
