import { useEffect, useMemo, useRef, useState } from "react";

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
  onChange: (v: string) => void;
}

function Select({ label, value, options, onChange }: SelectProps) {
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
              {option}
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
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => onQueryChange(draft), 180);
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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matchLabel = useMemo(() => {
    if (matched === total) return `${total} 个案例`;
    return `${matched} / ${total} 匹配`;
  }, [matched, total]);

  return (
    <div className="container-narrow pb-6 pt-4">
      <div className="surface p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
          <div className="flex flex-col gap-1.5">
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
                ref={inputRef}
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="搜索标题、Prompt、来源..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-16 text-sm font-medium text-ink-100 outline-none transition placeholder:text-ink-500 hover:border-white/25 focus:border-ember-500/60 focus:ring-2 focus:ring-ember-500/20"
                aria-label="搜索案例"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-ink-400 sm:inline-block">
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
          <Select label="风格" value={activeStyle} options={styles} onChange={onStyleChange} />
          <Select label="场景" value={activeScene} options={scenes} onChange={onSceneChange} />

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
    </div>
  );
}
