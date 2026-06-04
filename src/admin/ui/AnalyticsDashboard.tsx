import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildAnalyticsPlatformLinks,
  buildAnalyticsSetupChecklist,
  chartMaxValue,
  formatAnalyticsMetricLabel,
  formatCompactNumber,
  trendDelta,
} from "../analytics-dashboard-core.mjs";

interface RankedMetric {
  label: string;
  value: number;
}

interface DailyMetric {
  date: string;
  pageViews: number;
  visitors: number;
}

interface AnalyticsSummary {
  ok: boolean;
  range?: { days: number; from: string; to: string };
  totals?: { pageViews: number; visitors: number };
  today?: { pageViews: number; visitors: number };
  daily?: DailyMetric[];
  topPages?: RankedMetric[];
  topReferrers?: RankedMetric[];
  devices?: RankedMetric[];
  browsers?: RankedMetric[];
  os?: RankedMetric[];
  countries?: RankedMetric[];
  setup?: { requiredEnv?: string[] };
  error?: { code: string; message?: string };
}

interface AnalyticsDashboardProps {
  token: string;
}

const DAY_OPTIONS = [7, 30, 90] as const;

export function AnalyticsDashboard({ token }: AnalyticsDashboardProps) {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/analytics/summary?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = (await response.json()) as AnalyticsSummary;
      setSummary(payload);
      if (!response.ok && payload.error?.code !== "ANALYTICS_STORAGE_NOT_CONFIGURED") {
        setError(payload.error?.message || `统计接口返回 ${response.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [days, token]);

  useEffect(() => {
    load();
  }, [load]);

  const daily = summary?.daily || [];
  const totals = summary?.totals || { pageViews: 0, visitors: 0 };
  const today = summary?.today || { pageViews: 0, visitors: 0 };
  const pageViewTrend = trendDelta(daily, "pageViews");
  const visitorTrend = trendDelta(daily, "visitors");
  const storageMissing = summary?.error?.code === "ANALYTICS_STORAGE_NOT_CONFIGURED";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1 className="serif-display mt-1 text-3xl text-ink-50">数据看板</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-8 rounded-full border border-white/10 bg-white/[0.04] p-0.5">
            {DAY_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={
                  "h-7 rounded-full px-3 text-[12px] font-medium transition " +
                  (days === option
                    ? "bg-white/[0.12] text-ink-50"
                    : "text-ink-400 hover:bg-white/[0.05] hover:text-ink-100")
                }
              >
                {option} 天
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn-pill-ghost"
          >
            <RefreshIcon spinning={loading} /> 刷新
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto pr-1 scrollbar-thin">
        {loading && !summary ? (
          <LoadingPanel />
        ) : error ? (
          <ErrorPanel message={error} onRetry={load} />
        ) : storageMissing ? (
          <SetupPanel summary={summary} />
        ) : (
          <div className="space-y-4 pb-6">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="今日访客"
                value={today.visitors}
                caption={trendLabel(visitorTrend)}
                tone="emerald"
              />
              <MetricCard
                label="今日浏览"
                value={today.pageViews}
                caption={trendLabel(pageViewTrend)}
                tone="ember"
              />
              <MetricCard label={`${days} 天访客日累计`} value={totals.visitors} caption={summary?.range ? `${summary.range.from} 至 ${summary.range.to}` : ""} />
              <MetricCard label={`${days} 天浏览量`} value={totals.pageViews} caption="公开页面采集，不含后台" />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <TrendPanel daily={daily} />
              <PlatformPanel />
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <RankPanel title="热门页面" kind="page" items={summary?.topPages || []} empty="还没有页面访问数据" />
              <RankPanel title="访问来源" kind="referrer" items={summary?.topReferrers || []} empty="还没有来源数据" />
              <RankPanel title="国家 / 地区" kind="country" items={summary?.countries || []} empty="还没有地区数据" />
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <RankPanel title="设备" kind="device" items={summary?.devices || []} empty="还没有设备数据" />
              <RankPanel title="浏览器" kind="browser" items={summary?.browsers || []} empty="还没有浏览器数据" />
              <RankPanel title="系统" kind="os" items={summary?.os || []} empty="还没有系统数据" />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function trendLabel(delta: number | null) {
  if (delta === null) return "等待更多日期";
  if (delta === 0) return "与首日持平";
  return `${delta > 0 ? "+" : ""}${delta}% 对比首个有数据日`;
}

function MetricCard({
  label,
  value,
  caption,
  tone = "neutral",
}: {
  label: string;
  value: number;
  caption?: string;
  tone?: "neutral" | "ember" | "emerald";
}) {
  const toneClass =
    tone === "ember"
      ? "text-ember-200"
      : tone === "emerald"
        ? "text-emerald-200"
        : "text-ink-50";
  return (
    <article className="surface-form p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
        {label}
      </p>
      <strong className={`mt-3 block text-3xl font-semibold tabular-nums ${toneClass}`}>
        {formatCompactNumber(value)}
      </strong>
      {caption && <p className="mt-2 text-[12px] leading-relaxed text-ink-500">{caption}</p>}
    </article>
  );
}

function TrendPanel({ daily }: { daily: DailyMetric[] }) {
  const max = chartMaxValue(daily);
  return (
    <section className="surface-form p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
            Daily Traffic
          </p>
          <h2 className="mt-1 text-[17px] font-semibold text-ink-50">每日访问趋势</h2>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-ink-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ember-400" /> PV
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> UV
          </span>
        </div>
      </div>
      {daily.length === 0 ? (
        <EmptyMini label="暂无趋势数据" />
      ) : (
        <div className="flex h-64 items-end gap-1.5 overflow-x-auto pb-1 pt-4 scrollbar-thin">
          {daily.map((item) => {
            const pvHeight = Math.max(2, Math.round((item.pageViews / max) * 100));
            const uvHeight = Math.max(2, Math.round((item.visitors / max) * 100));
            return (
              <div key={item.date} className="flex h-full min-w-9 flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-48 w-full items-end justify-center gap-1">
                  <span
                    className="w-2.5 rounded-t-full bg-ember-400/80"
                    title={`${item.date} 浏览量 ${item.pageViews}`}
                    style={{ height: `${pvHeight}%` }}
                  />
                  <span
                    className="w-2.5 rounded-t-full bg-emerald-400/75"
                    title={`${item.date} 访客 ${item.visitors}`}
                    style={{ height: `${uvHeight}%` }}
                  />
                </div>
                <span className="text-[10.5px] tabular-nums text-ink-600">
                  {item.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RankPanel({
  title,
  kind,
  items,
  empty,
}: {
  title: string;
  kind: "page" | "referrer" | "country" | "device" | "browser" | "os";
  items: RankedMetric[];
  empty: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <section className="surface-form p-4">
      <h2 className="text-[15px] font-semibold text-ink-50">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <EmptyMini label={empty} />
        ) : (
          items.slice(0, 8).map((item) => {
            const displayLabel = formatAnalyticsMetricLabel(kind, item.label);
            return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="truncate text-ink-200" title={item.label}>
                    {displayLabel}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-500">{formatCompactNumber(item.value)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-ember-400/75"
                    style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function PlatformPanel() {
  const links = useMemo(
    () => buildAnalyticsPlatformLinks(),
    [],
  );
  return (
    <section className="surface-form p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
        Integrations
      </p>
      <h2 className="mt-1 text-[17px] font-semibold text-ink-50">外部平台</h2>
      <div className="mt-4 space-y-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[12.5px] transition hover:border-white/15 hover:bg-white/[0.05]"
          >
            <span className="font-medium text-ink-100">{link.label}</span>
            <span className="text-right text-[11.5px] text-ink-500">{link.status}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function SetupPanel({ summary }: { summary: AnalyticsSummary | null }) {
  const items = buildAnalyticsSetupChecklist(summary || {});
  return (
    <section className="surface-form mx-auto mt-8 max-w-3xl p-5">
      <div className="grid h-12 w-12 place-items-center rounded-xl border border-ember-500/30 bg-ember-500/10 text-ember-200">
        <DatabaseIcon />
      </div>
      <h2 className="serif-display mt-4 text-2xl text-ink-50">统计存储尚未配置</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
        站点采集代码已经接好；要在后台看到每日访问量，需要给 Vercel 生产环境接一个 Upstash / Vercel KV Redis 存储。
      </p>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2"
          >
            <code className="font-mono text-[12px] text-ink-200">{item.label}</code>
            <span className="text-[11.5px] text-ink-500">{item.done ? "已配置" : "待配置"}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3 font-mono text-[11.5px] leading-relaxed text-ink-300">
        npx vercel env add ANALYTICS_KV_REST_API_URL production
        <br />
        npx vercel env add ANALYTICS_KV_REST_API_TOKEN production
        <br />
        npx vercel env add ANALYTICS_ADMIN_TOKEN production
      </div>
    </section>
  );
}

function LoadingPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-400">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-ember-500/30 border-t-ember-500" />
      <p className="text-[12.5px]">正在加载统计数据…</p>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-200">
        <AlertIcon />
      </div>
      <p className="serif-display mt-4 text-2xl text-ink-50">统计加载失败</p>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-400">{message}</p>
      <button type="button" onClick={onRetry} className="btn-pill-ghost mt-5">
        重试
      </button>
    </div>
  );
}

function EmptyMini({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-center text-[12.5px] text-ink-500">
      {label}
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
