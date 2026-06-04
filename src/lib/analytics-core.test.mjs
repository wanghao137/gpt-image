import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClientPageViewPayload,
  classifyBrowser,
  classifyDevice,
  classifyOS,
  mergeRankedMetrics,
  normalizeAnalyticsPath,
  shouldTrackAnalyticsPath,
  toDateKey,
} from "./analytics-core.mjs";

test("normalizes analytics paths without leaking query strings", () => {
  assert.equal(
    normalizeAnalyticsPath("https://taostudioai.com/case/demo?utm_source=x#prompt"),
    "/case/demo",
  );
  assert.equal(normalizeAnalyticsPath("/cases/"), "/cases");
  assert.equal(normalizeAnalyticsPath("not a url"), "/");
});

test("skips admin, API, and static asset paths", () => {
  assert.equal(shouldTrackAnalyticsPath("/"), true);
  assert.equal(shouldTrackAnalyticsPath("/case/demo"), true);
  assert.equal(shouldTrackAnalyticsPath("/admin"), false);
  assert.equal(shouldTrackAnalyticsPath("/admin/settings"), false);
  assert.equal(shouldTrackAnalyticsPath("/admin.html"), false);
  assert.equal(shouldTrackAnalyticsPath("/api/analytics/collect"), false);
  assert.equal(shouldTrackAnalyticsPath("/images/case.jpg"), false);
  assert.equal(shouldTrackAnalyticsPath("/favicon.svg"), false);
});

test("classifies common user agents for dashboard segments", () => {
  const iphone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
  const edge =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0";
  const bot = "Googlebot/2.1 (+http://www.google.com/bot.html)";

  assert.equal(classifyDevice(iphone), "Mobile");
  assert.equal(classifyBrowser(iphone), "Safari");
  assert.equal(classifyOS(iphone), "iOS");

  assert.equal(classifyDevice(edge), "Desktop");
  assert.equal(classifyBrowser(edge), "Edge");
  assert.equal(classifyOS(edge), "Windows");

  assert.equal(classifyDevice(bot), "Bot");
});

test("builds minimal client page-view payloads", () => {
  assert.deepEqual(
    buildClientPageViewPayload({
      href: "https://taostudioai.com/templates?utm_campaign=x",
      referrer: "https://www.google.com/search?q=taostudio",
    }),
    {
      url: "https://taostudioai.com/templates?utm_campaign=x",
      path: "/templates",
      referrer: "https://www.google.com/search?q=taostudio",
    },
  );
});

test("formats date keys in the configured product timezone", () => {
  assert.equal(
    toDateKey(new Date("2026-06-03T16:30:00.000Z"), "Asia/Shanghai"),
    "2026-06-04",
  );
  assert.equal(
    toDateKey(new Date("2026-06-03T16:30:00.000Z"), "UTC"),
    "2026-06-03",
  );
});

test("merges ranked daily metrics into a period total", () => {
  assert.deepEqual(
    mergeRankedMetrics([
      [
        { label: "/cases", value: 3 },
        { label: "/templates", value: 2 },
      ],
      [
        { label: "/cases", value: 5 },
        { label: "/about", value: 1 },
      ],
    ]),
    [
      { label: "/cases", value: 8 },
      { label: "/templates", value: 2 },
      { label: "/about", value: 1 },
    ],
  );
});
