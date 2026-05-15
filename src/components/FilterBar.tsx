import { useEffect, useState } from "react";

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
}

interface ChipGroupProps {
  label: string;
  items: string[];
  active: string;
  onChange: (v: string) => void;
}

function ChipGroup({ label, items, active, onChange }: ChipGroupProps) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200/70">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const selected = item === active;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={
                "rounded-full border px-3 py-1.5 text-xs font-bold transition " +
                (selected
                  ? "border-cyan-200 bg-cyan-200 text-slate-950 shadow-lg shadow-cyan-300/20"
                  : "border-white/10 bg-white/[0.06] text-slate-300 hover:border-cyan-200/60 hover:text-white")
              }
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
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
}: FilterBarProps) {
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    const t = window.setTimeout(() => onQueryChange(draft), 200);
    return () => window.clearTimeout(t);
  }, [draft, onQueryChange]);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-7 pt-3 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-white/10 bg-[#090f20]/80 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-200/70">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.397 9.84l3.131 3.13a.75.75 0 1 0 1.06-1.06l-3.13-3.13A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="搜索案例、来源、Prompt..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/70 focus:ring-4 focus:ring-cyan-300/10"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white">
            {matched} <span className="text-xs font-bold text-slate-400">/ {total} 个匹配案例</span>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <ChipGroup label="分类" items={categories} active={activeCategory} onChange={onCategoryChange} />
          <ChipGroup label="风格" items={styles} active={activeStyle} onChange={onStyleChange} />
          <ChipGroup label="场景" items={scenes} active={activeScene} onChange={onSceneChange} />
        </div>
      </div>
    </section>
  );
}
