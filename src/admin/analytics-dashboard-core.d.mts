export function formatCompactNumber(value: number): string;
export function chartMaxValue(
  daily?: Array<{ date: string; pageViews: number; visitors: number }>,
): number;
export function trendDelta(
  daily?: Array<{ date: string; pageViews: number; visitors: number }>,
  metric?: "pageViews" | "visitors",
): number | null;
export function formatAnalyticsMetricLabel(
  kind: "page" | "referrer" | "country" | "device" | "browser" | "os",
  label: string,
): string;
export function buildAnalyticsPlatformLinks(): Array<{
  label: string;
  href: string;
  status: string;
}>;
export function buildAnalyticsSetupChecklist(summary: {
  ok?: boolean;
  setup?: { requiredEnv?: string[] };
}): Array<{ label: string; done: boolean }>;
