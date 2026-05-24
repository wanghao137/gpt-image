import { ReactNode, useEffect, useState } from "react";
import { lock } from "../auth";
import { REPO_TARGET } from "../config";
import { CaseEditor } from "./CaseEditor";
import { TemplateEditor } from "./TemplateEditor";
import { RawJson } from "./RawJson";
import { useAdminStore } from "../store";
import { BRAND } from "../../lib/brand";
import { Badge, BrandMark } from "./Primitives";
import {
  applyThemeToDocument,
  getSystemTheme,
  parseThemeMode,
  resolveEffectiveTheme,
  THEME_KEY,
} from "../../lib/theme";
import type { EffectiveTheme, ThemeMode } from "../../lib/theme";

interface ShellProps {
  token: string;
  login: string;
  onSignOut: () => void;
}

type Tab = "cases" | "templates" | "raw-cases" | "raw-templates";

interface TabDef {
  id: Tab;
  label: string;
  icon: ReactNode;
  group: "manage" | "raw";
}

const TABS: TabDef[] = [
  {
    id: "cases",
    label: "案例",
    group: "manage",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "templates",
    label: "模板",
    group: "manage",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <rect x="3" y="3" width="18" height="6" rx="1.5" />
        <rect x="3" y="13" width="11" height="8" rx="1.5" />
        <rect x="17" y="13" width="4" height="8" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "raw-cases",
    label: "案例 JSON",
    group: "raw",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    id: "raw-templates",
    label: "模板 JSON",
    group: "raw",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
];

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string }> = [
  { mode: "light", label: "浅色" },
  { mode: "dark", label: "深色" },
  { mode: "system", label: "系统" },
];

function initialThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    return parseThemeMode(window.localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

export function Shell({ token, login, onSignOut }: ShellProps) {
  const store = useAdminStore(token);
  const [tab, setTab] = useState<Tab>("cases");
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(() =>
    typeof window === "undefined" ? "dark" : getSystemTheme(),
  );
  const effectiveTheme = resolveEffectiveTheme(themeMode, systemTheme);

  // Browser-level guard against accidentally navigating away with unsaved edits.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (store.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [store.dirty]);

  useEffect(() => {
    applyThemeToDocument(effectiveTheme);
    try {
      window.localStorage.setItem(THEME_KEY, themeMode);
    } catch {
      return;
    }
  }, [effectiveTheme, themeMode]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setSystemTheme(getSystemTheme());
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const repoLabel = `${REPO_TARGET.owner}/${REPO_TARGET.repo}`;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        active={tab}
        onChange={setTab}
        login={login}
        onSignOut={() => {
          if (store.dirty) {
            if (!confirm("有未保存的改动。退出会丢失这些改动，确认继续？")) return;
          }
          lock();
          onSignOut();
        }}
        onRefresh={store.refresh}
        loading={store.loading}
        casesCount={store.cases.data.length}
        templatesCount={store.templates.data.length}
        dirty={store.dirty}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          login={login}
          repoLabel={repoLabel}
          loadError={store.loadError}
          loading={store.loading}
          dirty={store.dirty}
          themeMode={themeMode}
          effectiveTheme={effectiveTheme}
          onThemeModeChange={setThemeMode}
        />
        <MobileTabBar
          active={tab}
          onChange={setTab}
          casesCount={store.cases.data.length}
          templatesCount={store.templates.data.length}
        />
        <section className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8">
          {store.loadError ? (
            <ErrorState message={store.loadError} onRetry={store.refresh} />
          ) : store.loading && store.cases.sha === null ? (
            <LoadingState />
          ) : tab === "cases" ? (
            <CaseEditor
              cases={store.cases.data}
              onChange={store.setCases}
              onSave={store.saveCases}
              saving={store.saving}
              dirty={store.cases.dirty}
              token={token}
            />
          ) : tab === "templates" ? (
            <TemplateEditor
              templates={store.templates.data}
              onChange={store.setTemplates}
              onSave={store.saveTemplates}
              saving={store.saving}
              dirty={store.templates.dirty}
              token={token}
            />
          ) : tab === "raw-cases" ? (
            <RawJson
              label="cases"
              path="data/manual/cases.json"
              data={store.cases.data}
              onChange={store.setCases}
              onSave={store.saveCases}
              saving={store.saving}
              dirty={store.cases.dirty}
            />
          ) : (
            <RawJson
              label="templates"
              path="data/manual/templates.json"
              data={store.templates.data}
              onChange={store.setTemplates}
              onSave={store.saveTemplates}
              saving={store.saving}
              dirty={store.templates.dirty}
            />
          )}
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  login: string;
  onSignOut: () => void;
  onRefresh: () => void;
  loading: boolean;
  casesCount: number;
  templatesCount: number;
  dirty: boolean;
}

function Sidebar({
  active,
  onChange,
  login,
  onSignOut,
  onRefresh,
  loading,
  casesCount,
  templatesCount,
  dirty,
}: SidebarProps) {
  const groupItems = (group: "manage" | "raw") =>
    TABS.filter((t) => t.group === group);

  return (
    <aside className="admin-sidebar hidden w-64 shrink-0 flex-col border-r border-white/[0.05] bg-ink-950/60 backdrop-blur-xl md:flex">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <BrandMark />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500">
            {BRAND.latinName}
          </p>
          <p className="serif-display truncate text-[18px] leading-tight text-ink-50">
            {BRAND.adminShortTitle}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-ink-500">
            {BRAND.name}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 px-3 py-2">
        <NavGroup
          label="Manage"
          items={groupItems("manage").map((t) => ({
            ...t,
            count: t.id === "cases" ? casesCount : templatesCount,
          }))}
          active={active}
          onChange={onChange}
        />
        <NavGroup
          label="Raw"
          items={groupItems("raw")}
          active={active}
          onChange={onChange}
        />
      </nav>

      <div className="border-t border-white/[0.05] px-3 py-3">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="mb-2 flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] text-ink-400 transition hover:bg-white/[0.04] hover:text-ink-100 disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          从 GitHub 拉取最新
        </button>

        <div className="rounded-xl border border-white/[0.06] bg-ink-950/50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
            Signed in
          </p>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-ink-100">
            @{login}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            {dirty ? (
              <Badge tone="ember">● 未保存</Badge>
            ) : (
              <Badge tone="emerald">已同步</Badge>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="text-[11.5px] font-medium text-ink-400 transition hover:text-rose-300"
            >
              退出
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

interface NavGroupProps {
  label: string;
  items: {
    id: Tab;
    label: string;
    icon: ReactNode;
    count?: number;
  }[];
  active: Tab;
  onChange: (tab: Tab) => void;
}

function NavGroup({ label, items, active, onChange }: NavGroupProps) {
  return (
    <div>
      <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(item.id)}
                className={`group nav-row ${isActive ? "nav-row-active" : "nav-row-idle"}`}
              >
                <span
                  className={
                    isActive
                      ? "text-ember-300"
                      : "text-ink-500 group-hover:text-ink-300"
                  }
                >
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {typeof item.count === "number" && (
                  <span className="rounded-full bg-ink-950/40 px-1.5 py-0.5 text-[10.5px] tabular-nums text-ink-400">
                    {item.count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function countForTab(tab: Tab, casesCount: number, templatesCount: number) {
  if (tab === "cases") return casesCount;
  if (tab === "templates") return templatesCount;
  return undefined;
}

function MobileTabBar({
  active,
  onChange,
  casesCount,
  templatesCount,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  casesCount: number;
  templatesCount: number;
}) {
  return (
    <nav className="admin-mobile-tabs border-b border-white/[0.05] bg-ink-950/45 px-4 py-2 md:hidden">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
        {TABS.map((item) => {
          const isActive = item.id === active;
          const count = countForTab(item.id, casesCount, templatesCount);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition " +
                (isActive
                  ? "border-ember-500/45 bg-ember-500/15 text-ember-100"
                  : "border-white/[0.08] bg-white/[0.03] text-ink-300 hover:border-white/18 hover:text-ink-100")
              }
            >
              <span className={isActive ? "text-ember-300" : "text-ink-500"}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {typeof count === "number" && (
                <span className="rounded-full bg-ink-950/45 px-1.5 py-0.5 text-[10.5px] tabular-nums text-ink-400">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* TopBar                                                              */
/* ------------------------------------------------------------------ */

interface TopBarProps {
  login: string;
  repoLabel: string;
  loadError: string;
  loading: boolean;
  dirty: boolean;
  themeMode: ThemeMode;
  effectiveTheme: EffectiveTheme;
  onThemeModeChange: (mode: ThemeMode) => void;
}

function TopBar({
  login,
  repoLabel,
  loadError,
  loading,
  dirty,
  themeMode,
  effectiveTheme,
  onThemeModeChange,
}: TopBarProps) {
  const githubUrl = `https://github.com/${repoLabel}`;
  return (
    <header className="admin-topbar flex items-center justify-between border-b border-white/[0.05] bg-ink-950/55 px-6 py-2.5 backdrop-blur-xl backdrop-saturate-150 lg:px-8">
      <div className="flex items-center gap-2.5 text-[12px] text-ink-400">
        <span className="hidden md:inline">连接到</span>
        <a
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[11.5px] text-ink-200 transition hover:border-white/15 hover:text-ink-50"
          title="在 GitHub 打开"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3 w-3"
            aria-hidden="true"
          >
            <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.09-.74.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
          </svg>
          {repoLabel}
        </a>
        <span className="text-ink-700">·</span>
        <span>
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="status-dot animate-pulse bg-ember-400" />
              同步中
            </span>
          ) : loadError ? (
            <span className="inline-flex items-center gap-1.5 text-rose-300">
              <span className="status-dot bg-rose-400" />
              连接异常
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="status-dot bg-emerald-400" />
              在线
            </span>
          )}
        </span>
        {dirty && (
          <>
            <span className="text-ink-700">·</span>
            <span className="inline-flex items-center gap-1.5 text-ember-200">
              <span className="status-dot bg-ember-400" />
              有未保存改动
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3 text-[12px] text-ink-400">
        <ThemeSwitcher
          mode={themeMode}
          effectiveTheme={effectiveTheme}
          onChange={onThemeModeChange}
        />
        <span className="hidden md:inline">@{login}</span>
      </div>
    </header>
  );
}

function ThemeSwitcher({
  mode,
  effectiveTheme,
  onChange,
}: {
  mode: ThemeMode;
  effectiveTheme: EffectiveTheme;
  onChange: (mode: ThemeMode) => void;
}) {
  return (
    <div
      className="inline-flex h-8 items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-[12px] font-medium text-ink-300 shadow-inner backdrop-blur"
      role="radiogroup"
      aria-label="颜色模式"
    >
      {THEME_OPTIONS.map((option) => {
        const active = mode === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.mode)}
            className={
              "inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-2 transition " +
              (active
                ? "bg-white/[0.12] text-ink-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                : "text-ink-400 hover:bg-white/[0.05] hover:text-ink-100")
            }
            aria-label={`切换${option.label}模式`}
          >
            <ThemeIcon mode={option.mode} effectiveTheme={effectiveTheme} />
            <span className="hidden xl:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ThemeIcon({
  mode,
  effectiveTheme,
}: {
  mode: ThemeMode;
  effectiveTheme: EffectiveTheme;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      {mode === "light" ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </>
      ) : mode === "dark" ? (
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" />
      ) : (
        <>
          <rect x="3" y="4" width="18" height="13" rx="2.5" />
          <path d="M8 21h8M12 17v4" />
          {effectiveTheme === "light" ? (
            <circle cx="17" cy="8" r="1.5" />
          ) : (
            <path d="M18.5 8.7A2.6 2.6 0 1 1 15.3 5.5 2.2 2.2 0 0 0 18.5 8.7Z" />
          )}
        </>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Loading / error states                                              */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-400">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-ember-500/30 border-t-ember-500" />
      <p className="text-[12.5px]">从 GitHub 拉取数据…</p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-200">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="serif-display mt-4 text-2xl text-ink-50">加载失败</p>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="btn-pill-ghost mt-5"
      >
        重试
      </button>
    </div>
  );
}
