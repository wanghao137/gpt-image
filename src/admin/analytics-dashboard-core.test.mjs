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

test("formats compact dashboard numbers", () => {
  assert.equal(formatCompactNumber(0), "0");
  assert.equal(formatCompactNumber(999), "999");
  assert.equal(formatCompactNumber(1250), "1.3k");
  assert.equal(formatCompactNumber(1200000), "1.2m");
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

test("calculates trend delta between first and last non-empty points", () => {
  assert.equal(
    trendDelta([
      { date: "2026-06-02", pageViews: 10, visitors: 2 },
      { date: "2026-06-03", pageViews: 20, visitors: 4 },
    ], "pageViews"),
    100,
  );
  assert.equal(
    trendDelta([{ date: "2026-06-03", pageViews: 20, visitors: 0 }], "visitors"),
    null,
  );
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
