import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAnalyticsSetupChecklist,
  buildAnalyticsPlatformLinks,
  chartMaxValue,
  formatAnalyticsMetricLabel,
  formatCompactNumber,
  trendDelta,
} from "./analytics-dashboard-core.mjs";

test("formats compact dashboard numbers in Chinese units", () => {
  assert.equal(formatCompactNumber(0), "0");
  assert.equal(formatCompactNumber(999), "999");
  assert.equal(formatCompactNumber(1250), "1250");
  assert.equal(formatCompactNumber(12345), "1.2万");
  assert.equal(formatCompactNumber(1200000), "120万");
  assert.equal(formatCompactNumber(150000000), "1.5亿");
});

test("uses at least one as chart maximum", () => {
  assert.equal(chartMaxValue([]), 1);
  assert.equal(
    chartMaxValue([
      { date: "2026-06-03", pageViews: 0, visitors: 0 },
      { date: "2026-06-04", pageViews: 12, visitors: 3 },
    ]),
    12,
  );
});

test("trend delta compares trailing 7 days against the previous 7 days", () => {
  const day = (date, pageViews) => ({ date, pageViews, visitors: 1 });
  const daily = [
    ...Array.from({ length: 7 }, (_, i) => day(`2026-06-0${i + 1}`, 10)), // prev7 = 70
    ...Array.from({ length: 7 }, (_, i) => day(`2026-06-1${i % 10}`, 20)), // last7 = 140
  ];
  assert.equal(trendDelta(daily, "pageViews"), 100);

  // Not enough history for a week-over-week comparison.
  assert.equal(
    trendDelta([
      { date: "2026-06-02", pageViews: 10, visitors: 2 },
      { date: "2026-06-03", pageViews: 20, visitors: 4 },
    ], "pageViews"),
    null,
  );
  // Previous week had zero traffic — no meaningful ratio.
  const flatStart = [
    ...Array.from({ length: 7 }, (_, i) => day(`2026-06-0${i + 1}`, 0)),
    ...Array.from({ length: 7 }, (_, i) => day(`2026-06-1${i % 10}`, 5)),
  ];
  assert.equal(trendDelta(flatStart, "pageViews"), null);
});

test("builds setup checklist from summary errors", () => {
  assert.deepEqual(
    buildAnalyticsSetupChecklist({
      ok: false,
      setup: { requiredEnv: ["KV_REST_API_URL", "KV_REST_API_TOKEN"] },
    }),
    [
      { label: "KV_REST_API_URL", done: false },
      { label: "KV_REST_API_TOKEN", done: false },
    ],
  );
});

test("localizes analytics segment labels for the admin dashboard", () => {
  assert.equal(formatAnalyticsMetricLabel("referrer", "Direct"), "直接访问");
  assert.equal(formatAnalyticsMetricLabel("referrer", "Internal"), "站内跳转");
  assert.equal(formatAnalyticsMetricLabel("country", "CN"), "中国");
  assert.equal(formatAnalyticsMetricLabel("device", "Desktop"), "桌面端");
  assert.equal(formatAnalyticsMetricLabel("browser", "Other"), "其他浏览器");
  assert.equal(formatAnalyticsMetricLabel("os", "Other"), "其他系统");
  assert.equal(formatAnalyticsMetricLabel("page", "/case/demo"), "/case/demo");
});

test("marks Google Search Console as verified in dashboard integrations", () => {
  const google = buildAnalyticsPlatformLinks().find((link) => link.label === "Google Search Console");
  assert.deepEqual(google, {
    label: "Google Search Console",
    href: "https://search.google.com/search-console",
    status: "已验证，Sitemap 可提交",
  });
});
