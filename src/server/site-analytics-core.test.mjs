import test from "node:test";
import assert from "node:assert/strict";

import {
  authorizeAnalyticsSummaryRequest,
  buildPageViewRecord,
  buildSummaryDateKeys,
  getAnalyticsConfig,
  handleAnalyticsSummary,
  handleCollectPageView,
  isAuthorizedAnalyticsToken,
  parseRedisHash,
  parseRedisRankedPairs,
} from "./site-analytics-core.mjs";

const ANALYTICS_ENV = {
  KV_REST_API_URL: "https://redis.example.com",
  KV_REST_API_TOKEN: "kv-token",
  ANALYTICS_ADMIN_TOKEN: "admin-token",
};

function collectTestPageView(fetchImpl) {
  return handleCollectPageView({
    body: { url: "https://taostudioai.com/cases", referrer: "" },
    headers: {
      "user-agent": "TaoStudio quality test",
      "x-real-ip": "203.0.113.10",
    },
    env: ANALYTICS_ENV,
    now: new Date("2026-06-04T04:00:00.000Z"),
    fetchImpl,
  });
}

test("reads analytics configuration from Vercel KV or dedicated env names", () => {
  const config = getAnalyticsConfig({
    KV_REST_API_URL: "https://redis.example.com",
    KV_REST_API_TOKEN: "kv-token",
    HERMES_ADMIN_API_KEY: "admin-token",
  });

  assert.equal(config.storageConfigured, true);
  assert.equal(config.kvUrl, "https://redis.example.com");
  assert.equal(config.kvToken, "kv-token");
  assert.equal(config.adminToken, "admin-token");
  assert.equal(config.keyPrefix, "taostudio:analytics");
  assert.equal(config.timeZone, "Asia/Shanghai");
});

test("uses constant-time authorization for analytics admin tokens", () => {
  const env = { ANALYTICS_ADMIN_TOKEN: "secret" };

  assert.equal(isAuthorizedAnalyticsToken("Bearer secret", env), true);
  assert.equal(isAuthorizedAnalyticsToken("secret", env), true);
  assert.equal(isAuthorizedAnalyticsToken("Bearer wrong", env), false);
  assert.equal(isAuthorizedAnalyticsToken("", env), false);
});

test("authorizes summary reads with either admin token or repo-scoped GitHub token", async () => {
  assert.equal(
    await authorizeAnalyticsSummaryRequest({
      authorization: "Bearer analytics-secret",
      env: { ANALYTICS_ADMIN_TOKEN: "analytics-secret" },
      fetchImpl: async () => {
        throw new Error("GitHub should not be called for admin-token auth");
      },
    }),
    true,
  );

  const calls = [];
  assert.equal(
    await authorizeAnalyticsSummaryRequest({
      authorization: "Bearer gh-token",
      env: { HERMES_REPO_OWNER: "wanghao137", HERMES_REPO_NAME: "gpt-image" },
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return { ok: true };
      },
    }),
    true,
  );
  assert.equal(calls[0].url, "https://api.github.com/repos/wanghao137/gpt-image");
  assert.equal(calls[0].init.headers.Authorization, "Bearer gh-token");

  assert.equal(
    await authorizeAnalyticsSummaryRequest({
      authorization: "Bearer bad-token",
      env: { HERMES_REPO_OWNER: "wanghao137", HERMES_REPO_NAME: "gpt-image" },
      fetchImpl: async () => ({ ok: false }),
    }),
    false,
  );
});

test("builds privacy-preserving page-view records", () => {
  const record = buildPageViewRecord({
    body: {
      url: "https://taostudioai.com/case/demo?utm_source=x",
      referrer: "https://www.google.com/search?q=taostudio",
    },
    headers: {
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
      "x-real-ip": "203.0.113.10",
      "x-vercel-ip-country": "CN",
    },
    now: new Date("2026-06-03T16:30:00.000Z"),
    salt: "test-salt",
    timeZone: "Asia/Shanghai",
  });

  assert.equal(record.date, "2026-06-04");
  assert.equal(record.path, "/case/demo");
  assert.equal(record.referrer, "google.com");
  assert.equal(record.device, "Mobile");
  assert.equal(record.browser, "Safari");
  assert.equal(record.os, "iOS");
  assert.equal(record.country, "CN");
  assert.match(record.visitorHash, /^[a-f0-9]{64}$/);
  assert.equal(record.ip, undefined);
});

test("marks non-public paths as skipped records", () => {
  const record = buildPageViewRecord({
    body: { url: "https://taostudioai.com/admin" },
    headers: { "user-agent": "Mozilla/5.0", "x-real-ip": "203.0.113.10" },
    now: new Date("2026-06-04T08:00:00.000Z"),
    salt: "test-salt",
    timeZone: "Asia/Shanghai",
  });

  assert.equal(record.skipped, true);
});

test("builds inclusive summary date keys ending today", () => {
  assert.deepEqual(
    buildSummaryDateKeys({
      days: 3,
      now: new Date("2026-06-04T04:00:00.000Z"),
      timeZone: "Asia/Shanghai",
    }),
    ["2026-06-02", "2026-06-03", "2026-06-04"],
  );
});

test("parses Redis REST hashes and ranked arrays", () => {
  assert.deepEqual(parseRedisHash(["pageViews", "12", "visitors", "5"]), {
    pageViews: 12,
    visitors: 5,
  });

  assert.deepEqual(parseRedisRankedPairs(["/cases", "7", "/templates", "2"]), [
    { label: "/cases", value: 7 },
    { label: "/templates", value: 2 },
  ]);
});

test("batches one page view into one Redis pipeline request", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const commands = JSON.parse(init.body);
    calls.push({ url, init, commands });
    return {
      ok: true,
      status: 200,
      json: async () => commands.map(() => ({ result: "OK" })),
    };
  };

  const result = await handleCollectPageView({
    body: {
      url: "https://taostudioai.com/cases?utm_source=quality-test",
      referrer: "",
    },
    headers: {
      "user-agent": "TaoStudio quality test",
      "x-real-ip": "203.0.113.10",
      "x-vercel-ip-country": "CN",
    },
    env: ANALYTICS_ENV,
    now: new Date("2026-06-04T04:00:00.000Z"),
    fetchImpl,
  });

  assert.deepEqual(result, { ok: true, skipped: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://redis.example.com/pipeline");
  assert.equal(calls[0].init.headers.Authorization, "Bearer kv-token");
  assert.equal(calls[0].commands.length, 16);
  assert.deepEqual(calls[0].commands[0].slice(0, 2), [
    "PFADD",
    "taostudio:analytics:visitors:2026-06-04",
  ]);
  assert.deepEqual(calls[0].commands[1], [
    "HINCRBY",
    "taostudio:analytics:day:2026-06-04",
    "pageViews",
    1,
  ]);
});

test("reads a multi-day summary through one Redis pipeline request", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const commands = JSON.parse(init.body);
    calls.push({ url, commands });
    const payload = commands.map((_command, index) => {
      const day = Math.floor(index / 8) + 1;
      switch (index % 8) {
        case 0:
          return { result: ["pageViews", String(day * 10)] };
        case 1:
          return { result: day * 3 };
        case 2:
          return { result: [`/page-${day}`, String(day * 5)] };
        case 3:
          return { result: ["Direct", String(day * 4)] };
        case 4:
          return { result: ["Mobile", String(day * 3)] };
        case 5:
          return { result: ["Chrome", String(day * 2)] };
        case 6:
          return { result: ["Windows", String(day)] };
        default:
          return { result: ["CN", String(day * 6)] };
      }
    });
    return { ok: true, status: 200, json: async () => payload };
  };

  const summary = await handleAnalyticsSummary({
    days: 2,
    env: ANALYTICS_ENV,
    now: new Date("2026-06-04T04:00:00.000Z"),
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://redis.example.com/pipeline");
  assert.equal(calls[0].commands.length, 16);
  assert.deepEqual(summary.daily, [
    { date: "2026-06-03", pageViews: 10, visitors: 3 },
    { date: "2026-06-04", pageViews: 20, visitors: 6 },
  ]);
  assert.deepEqual(summary.totals, { pageViews: 30, visitors: 9 });
  assert.deepEqual(summary.topPages, [
    { label: "/page-2", value: 10 },
    { label: "/page-1", value: 5 },
  ]);
});

test("rejects a Redis pipeline response containing a command error", async () => {
  const fetchImpl = async (_url, init) => {
    const commands = JSON.parse(init.body);
    const payload = commands.map(() => ({ result: "OK" }));
    payload[3] = { error: "injected failure" };
    return { ok: true, status: 200, json: async () => payload };
  };

  await assert.rejects(
    () => collectTestPageView(fetchImpl),
    /Redis pipeline command 4 failed: injected failure/,
  );
});

test("rejects a non-array Redis pipeline response", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ result: "OK" }),
  });

  await assert.rejects(
    () => collectTestPageView(fetchImpl),
    /Redis pipeline returned a non-array response/,
  );
});

test("rejects a Redis pipeline response with the wrong result count", async () => {
  const fetchImpl = async (_url, init) => {
    const commands = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => commands.slice(1).map(() => ({ result: "OK" })),
    };
  };

  await assert.rejects(
    () => collectTestPageView(fetchImpl),
    /Redis pipeline returned 15 results for 16 commands/,
  );
});

test("rejects an invalid Redis pipeline result item", async () => {
  const fetchImpl = async (_url, init) => {
    const commands = JSON.parse(init.body);
    const payload = commands.map(() => ({ result: "OK" }));
    payload[2] = null;
    return { ok: true, status: 200, json: async () => payload };
  };

  await assert.rejects(
    () => collectTestPageView(fetchImpl),
    /Redis pipeline command 3 returned an invalid result/,
  );
});
