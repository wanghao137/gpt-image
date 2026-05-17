import { ReactNode, useEffect, useState } from "react";
import { lock } from "../auth";
import { REPO_TARGET } from "../config";
import { CaseEditor } from "./CaseEditor";
import { TemplateEditor } from "./TemplateEditor";
import { RawJson } from "./RawJson";
import { useAdminStore } from "../store";
import { Badge } from "./Primitives";

interface ShellProps {
  token: string;
  login: string;
  onSignOut: () => void;
}

type Tab = "cases" | "templates" | "raw-cases" | "raw-templates";

const TABS: { id: Tab; label: string; icon: ReactNode; group: "manage" | "raw" }[] = [
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

export function Shell({ token, login, onSignOut }: ShellProps) {
  const store = useAdminStore(token);
  const [tab, setTab] = useState<Tab>("cases");

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
        />
        <section className="flex-1 overflow-hidden p-6">
          {store.loadError ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="serif-display text-2xl text-rose-200">加载失败</p>
              <p className="mt-2 max-w-md text-[13px] text-ink-400">{store.loadError}</p>
              <button
                type="button"
                onClick={store.refresh}
                className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-ink-100 transition hover:border-white/25"
              >
                重试
              </button>
            </div>
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
  const groupItems = (group: "manage" | "raw") => TABS.filter((t) => t.group === group);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.05] bg-ink-900/40 backdrop-blur-sm md:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span
          aria-hidden
          className="grid h-9 w-9 place-items-center rounded-xl bg-ember-500/15 text-ember-300 ring-1 ring-ember-500/20"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
          </svg>
        </span>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-500">
            Gallery
          </p>
          <p className="serif-display text-[17px] leading-tight text-ink-50">Admin Studio</p>
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
          className="mb-2 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink-400 transition hover:bg-white/[0.04] hover:text-ink-100 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          从 GitHub 拉取最新
        </button>

        <div className="rounded-lg border border-white/[0.05] bg-ink-950/40 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500">
            Signed in
          </p>
          <p className="mt-1 truncate text-[13px] font-medium text-ink-100">{login}</p>
          <div className="mt-2 flex items-center justify-between">
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
      <p className="px-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-ink-500">
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
                className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition ${
                  isActive
                    ? "bg-white/[0.06] text-ink-50 ring-1 ring-white/[0.08]"
                    : "text-ink-300 hover:bg-white/[0.03] hover:text-ink-50"
                }`}
              >
                <span className={isActive ? "text-ember-300" : "text-ink-500 group-hover:text-ink-300"}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left font-medium">{item.label}</span>
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

interface TopBarProps {
  login: string;
  repoLabel: string;
  loadError: string;
  loading: boolean;
}

function TopBar({ login, repoLabel, loadError, loading }: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-white/[0.05] bg-ink-900/30 px-6 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[12px] text-ink-400">
        <span className="hidden md:inline">连接到</span>
        <code className="rounded-md bg-white/[0.03] px-2 py-0.5 font-mono text-[11.5px] text-ink-200">
          {repoLabel}
        </code>
        <span className="text-ink-600">·</span>
        <span>
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-400" />
              同步中
            </span>
          ) : loadError ? (
            <span className="text-rose-300">连接异常</span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              在线
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[12px] text-ink-400 md:hidden">
        @{login}
      </div>
    </header>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-400">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-ember-500/30 border-t-ember-500" />
      <p className="text-[12.5px]">从 GitHub 拉取数据…</p>
    </div>
  );
}
