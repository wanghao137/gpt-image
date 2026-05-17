import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { sceneLabel, styleLabel } from "../lib/labels";
import { HOMEPAGE_USER_CATEGORIES, USER_CATEGORIES } from "../lib/userCategories";

interface FilterBarProps {
  query: string;
  onQueryChange: (v: string) => void;
  /** Active user-category slugs. Multiple values combine with OR. */
  activeCategories: Set<string>;
  onCategoriesChange: (next: Set<string>) => void;
  /** Active style values. Multiple values combine with OR. */
  styles: string[];
  activeStyles: Set<string>;
  onStylesChange: (next: Set<string>) => void;
  /** Active scene values. Multiple values combine with OR. */
  scenes: string[];
  activeScenes: Set<string>;
  onScenesChange: (next: Set<string>) => void;
  /** Active platforms. Multiple values combine with OR. */
  activePlatforms: Set<string>;
  onPlatformsChange: (next: Set<string>) => void;
  total: number;
  matched: number;
  hasActiveFilter: boolean;
  onReset: () => void;
}

const PLATFORM_OPTIONS = [
  { key: "xiaohongshu", label: "小红书" },
  { key: "wechat", label: "微信" },
  { key: "douyin", label: "抖音" },
  { key: "ec", label: "电商" },
  { key: "offline", label: "线下" },
];

/**
 * Chip-driven multi-select filter bar.
 *
 *   - Categories / styles / scenes / platforms each render as chip rows.
 *   - Tapping a chip toggles its membership in the corresponding Set.
 *   - All chip selections combine across axes with AND, within an axis with OR.
 *   - URL ?q= ?cat= ?style= ?scene= ?platform= is owned by the parent (CasesPage).
 *   - On mobile, axes collapse into a bottom sheet drawer with a sticky "Apply"
 *     button — the chip rows stay accessible above the fold.
 */
export function FilterBar({
  query,
  onQueryChange,
  activeCategories,
  onCategoriesChange,
  styles,
  activeStyles,
  onStylesChange,
  scenes,
  activeScenes,
  onScenesChange,
  activePlatforms,
  onPlatformsChange,
  total,
  matched,
  hasActiveFilter,
  onReset,
}: FilterBarProps) {
  const [draft, setDraft] = useState(query);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Debounce search input.
  useEffect(() => {
    const t = window.setTimeout(() => onQueryChange(draft), 200);
    return () => window.clearTimeout(t);
  }, [draft, onQueryChange]);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  // ⌘K / Ctrl+K focuses search.
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
    activeCategories.size + activeStyles.size + activeScenes.size + activePlatforms.size;

  function toggle(set: Set<string>, val: string, setter: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  }

  return (
    <div className="container-narrow pb-6 pt-4">
      <div className="surface p-3 sm:p-5">
        {/* Search row */}
        <div className="flex items-center gap-2">
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
              placeholder="搜索标题、Prompt、来源…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-16 text-sm font-medium text-ink-100 outline-none transition placeholder:text-ink-500 hover:border-white/25 focus:border-ember-500/60 focus:ring-2 focus:ring-ember-500/20"
              aria-label="搜索案例"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-ink-400 lg:inline-block">
              ⌘K
            </kbd>
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm font-medium text-ink-100 transition hover:border-white/25 sm:hidden"
            aria-label="筛选"
          >
            <FilterIcon />
            筛选
            {activeCount > 0 && (
              <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-ember-500 px-1.5 text-[11px] font-semibold tabular-nums text-ink-950">
                {activeCount}
              </span>
            )}
          </button>

          <span className="hidden rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] font-medium tabular-nums text-ink-200 sm:inline-block">
            {matchLabel}
          </span>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={onReset}
              className="hidden rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] font-medium text-ink-300 transition hover:border-white/25 hover:text-ink-50 sm:inline-block"
            >
              清除
            </button>
          )}
        </div>

        {/* Desktop chip rows */}
        <div className="hidden flex-col gap-3 pt-4 sm:flex">
          <ChipRow
            label="场景"
            options={USER_CATEGORIES.filter((c) => c.pinnedHomepage).map((c) => ({
              key: c.slug,
              label: c.label,
            }))}
            selected={activeCategories}
            onToggle={(k) => toggle(activeCategories, k, onCategoriesChange)}
            secondary={USER_CATEGORIES.filter((c) => !c.pinnedHomepage).map((c) => ({
              key: c.slug,
              label: c.label,
            }))}
          />
          <ChipRow
            label="平台"
            options={PLATFORM_OPTIONS.map((p) => ({ key: p.key, label: p.label }))}
            selected={activePlatforms}
            onToggle={(k) => toggle(activePlatforms, k, onPlatformsChange)}
          />
          <ChipRow
            label="风格"
            options={styles.map((s) => ({ key: s, label: styleLabel(s) }))}
            selected={activeStyles}
            onToggle={(k) => toggle(activeStyles, k, onStylesChange)}
            collapsible
          />
          <ChipRow
            label="题材"
            options={scenes.map((s) => ({ key: s, label: sceneLabel(s) }))}
            selected={activeScenes}
            onToggle={(k) => toggle(activeScenes, k, onScenesChange)}
            collapsible
          />
        </div>

        {/* Mobile match label below the search row */}
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
      </div>

      {/* Quick category jump links — long-tail SEO + 1-tap browse */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2 sm:hidden">
        {HOMEPAGE_USER_CATEGORIES.slice(0, 8).map((c) => (
          <Link
            key={c.slug}
            to={`/category/${c.slug}`}
            className="chip chip-idle shrink-0"
          >
            {c.label}
          </Link>
        ))}
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
            className="relative z-10 flex max-h-[88vh] w-full flex-col rounded-t-3xl border-t border-white/10 bg-ink-900"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mt-3 mb-2 h-1 w-10 rounded-full bg-white/15" />
            <div className="flex items-center justify-between px-5 pb-3">
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

            <div className="flex flex-1 flex-col gap-5 overflow-auto px-5 pb-4">
              <ChipRow
                label="场景"
                options={USER_CATEGORIES.map((c) => ({ key: c.slug, label: c.label }))}
                selected={activeCategories}
                onToggle={(k) => toggle(activeCategories, k, onCategoriesChange)}
              />
              <ChipRow
                label="平台"
                options={PLATFORM_OPTIONS.map((p) => ({ key: p.key, label: p.label }))}
                selected={activePlatforms}
                onToggle={(k) => toggle(activePlatforms, k, onPlatformsChange)}
              />
              <ChipRow
                label="风格"
                options={styles.map((s) => ({ key: s, label: styleLabel(s) }))}
                selected={activeStyles}
                onToggle={(k) => toggle(activeStyles, k, onStylesChange)}
              />
              <ChipRow
                label="题材"
                options={scenes.map((s) => ({ key: s, label: sceneLabel(s) }))}
                selected={activeScenes}
                onToggle={(k) => toggle(activeScenes, k, onScenesChange)}
              />
            </div>

            <div className="flex gap-2 border-t border-white/[0.06] p-4">
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

interface ChipOption {
  key: string;
  label: string;
}

function ChipRow({
  label,
  options,
  selected,
  onToggle,
  secondary,
  collapsible,
}: {
  label: string;
  options: ChipOption[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  /** Optional second-tier options shown after a "more" toggle. */
  secondary?: ChipOption[];
  /** When true, the row collapses to ~2 lines with an inline expand toggle. */
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = collapsible && !expanded ? options.slice(0, 12) : options;
  const showMore = collapsible && options.length > 12 && !expanded;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {(secondary || showMore) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11.5px] font-medium text-ink-400 transition hover:text-ink-100"
          >
            {expanded ? "收起" : "更多"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((opt) => {
          const active = selected.has(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onToggle(opt.key)}
              className={`chip ${active ? "chip-active" : "chip-idle"}`}
            >
              {opt.label}
              {active && (
                <span aria-hidden="true" className="-mr-0.5 ml-0.5 text-[10px] opacity-70">
                  ×
                </span>
              )}
            </button>
          );
        })}
        {expanded && secondary?.map((opt) => {
          const active = selected.has(opt.key);
          return (
            <button
              key={`sec-${opt.key}`}
              type="button"
              onClick={() => onToggle(opt.key)}
              className={`chip ${active ? "chip-active" : "chip-idle"}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterIcon() {
  return (
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
  );
}
