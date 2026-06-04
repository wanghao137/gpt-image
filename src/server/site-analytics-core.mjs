import { createHash, timingSafeEqual } from "node:crypto";
import {
  classifyBrowser,
  classifyDevice,
  classifyOS,
  mergeRankedMetrics,
  normalizeAnalyticsPath,
  shouldTrackAnalyticsPath,
  toDateKey,
} from "../lib/analytics-core.mjs";

const DEFAULT_PREFIX = "taostudio:analytics";
const DEFAULT_TIME_ZONE = "Asia/Shanghai";

export function getAnalyticsConfig(env = {}) {
  const kvUrl =
    env.ANALYTICS_KV_REST_API_URL ||
    env.KV_REST_API_URL ||
    env.UPSTASH_REDIS_REST_URL ||
    "";
  const kvToken =
    env.ANALYTICS_KV_REST_API_TOKEN ||
    env.KV_REST_API_TOKEN ||
    env.UPSTASH_REDIS_REST_TOKEN ||
    "";
  const adminToken = env.ANALYTICS_ADMIN_TOKEN || env.HERMES_ADMIN_API_KEY || "";
  return {
    kvUrl: String(kvUrl).replace(/\/$/, ""),
    kvToken: String(kvToken),
    adminToken: String(adminToken),
    keyPrefix: env.ANALYTICS_KEY_PREFIX || DEFAULT_PREFIX,
    timeZone: env.ANALYTICS_TIME_ZONE || DEFAULT_TIME_ZONE,
    salt: env.ANALYTICS_SALT || adminToken || "taostudio-analytics",
    storageConfigured: Boolean(kvUrl && kvToken),
    repoOwner: env.HERMES_REPO_OWNER || env.VITE_ADMIN_REPO_OWNER || "wanghao137",
    repoName: env.HERMES_REPO_NAME || env.VITE_ADMIN_REPO_NAME || "gpt-image",
  };
}

function normalizeBearer(value = "") {
  return String(value).replace(/^Bearer\s+/i, "").trim();
}

export function isAuthorizedAnalyticsToken(authorization = "", env = {}) {
  const expected = getAnalyticsConfig(env).adminToken;
  const actual = normalizeBearer(authorization);
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export async function authorizeAnalyticsSummaryRequest({
  authorization = "",
  env = {},
  fetchImpl = fetch,
} = {}) {
  if (isAuthorizedAnalyticsToken(authorization, env)) return true;

  const token = normalizeBearer(authorization);
  if (!token) return false;

  const config = getAnalyticsConfig(env);
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${config.repoOwner}/${config.repoName}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "taostudio-analytics-admin",
        },
      },
    );
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}

function headerValue(headers = {}, name) {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === lower) return Array.isArray(value) ? value[0] : value;
  }
  return "";
}

function clientIp(headers = {}) {
  const real = headerValue(headers, "x-real-ip") || headerValue(headers, "x-vercel-forwarded-for");
  if (real) return String(real).split(",")[0].trim();
  const forwarded = headerValue(headers, "x-forwarded-for");
  if (forwarded) {
    const parts = String(forwarded).split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}

function referrerLabel(referrer = "", siteHost = "taostudioai.com") {
  if (!referrer) return "Direct";
  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, "");
    if (!host || host === siteHost) return "Internal";
    return host;
  } catch {
    return "Unknown";
  }
}

function hashVisitor({ ip, userAgent, date, salt }) {
  return createHash("sha256")
    .update([salt, date, ip, userAgent].join("|"))
    .digest("hex");
}

export function buildPageViewRecord({
  body = {},
  headers = {},
  now = new Date(),
  salt = "taostudio-analytics",
  timeZone = DEFAULT_TIME_ZONE,
} = {}) {
  const url = typeof body.url === "string" ? body.url : "";
  const path = normalizeAnalyticsPath(url || body.path || "/");
  if (!shouldTrackAnalyticsPath(path)) {
    return { skipped: true, path };
  }

  const userAgent = String(headerValue(headers, "user-agent") || "");
  const date = toDateKey(now, timeZone);
  let siteHost = "taostudioai.com";
  try {
    siteHost = new URL(url || "https://taostudioai.com").hostname.replace(/^www\./, "");
  } catch {
    /* keep default */
  }

  return {
    date,
    path,
    referrer: referrerLabel(body.referrer, siteHost),
    device: classifyDevice(userAgent),
    browser: classifyBrowser(userAgent),
    os: classifyOS(userAgent),
    country: String(headerValue(headers, "x-vercel-ip-country") || "Unknown").toUpperCase(),
    visitorHash: hashVisitor({
      ip: clientIp(headers),
      userAgent,
      date,
      salt,
    }),
  };
}

export function buildSummaryDateKeys({
  days = 30,
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
} = {}) {
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 90);
  const keys = [];
  const base = new Date(now);
  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() - offset);
    keys.push(toDateKey(date, timeZone));
  }
  return keys;
}

export function parseRedisHash(value) {
  if (!value) return {};
  if (!Array.isArray(value) && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, Number(item) || 0]),
    );
  }
  const result = {};
  for (let i = 0; i < value.length; i += 2) {
    result[String(value[i])] = Number(value[i + 1]) || 0;
  }
  return result;
}

export function parseRedisRankedPairs(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (let i = 0; i < value.length; i += 2) {
    result.push({ label: String(value[i]), value: Number(value[i + 1]) || 0 });
  }
  return result.filter((item) => item.label && item.value > 0);
}

export function analyticsKeys(prefix, date) {
  return {
    day: `${prefix}:day:${date}`,
    visitors: `${prefix}:visitors:${date}`,
    pages: `${prefix}:pages:${date}`,
    referrers: `${prefix}:referrers:${date}`,
    devices: `${prefix}:devices:${date}`,
    browsers: `${prefix}:browsers:${date}`,
    os: `${prefix}:os:${date}`,
    countries: `${prefix}:countries:${date}`,
  };
}

async function redisCommand(config, command, fetchImpl = fetch) {
  const response = await fetchImpl(config.kvUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.kvToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `Redis command failed with ${response.status}`);
  }
  return payload.result;
}

async function recordPageView(config, record, fetchImpl) {
  const keys = analyticsKeys(config.keyPrefix, record.date);
  const expireSeconds = 400 * 24 * 60 * 60;
  const commands = [
    ["PFADD", keys.visitors, record.visitorHash],
    ["HINCRBY", keys.day, "pageViews", 1],
    ["ZINCRBY", keys.pages, 1, record.path],
    ["ZINCRBY", keys.referrers, 1, record.referrer],
    ["ZINCRBY", keys.devices, 1, record.device],
    ["ZINCRBY", keys.browsers, 1, record.browser],
    ["ZINCRBY", keys.os, 1, record.os],
    ["ZINCRBY", keys.countries, 1, record.country],
    ["EXPIRE", keys.day, expireSeconds],
    ["EXPIRE", keys.visitors, expireSeconds],
    ["EXPIRE", keys.pages, expireSeconds],
    ["EXPIRE", keys.referrers, expireSeconds],
    ["EXPIRE", keys.devices, expireSeconds],
    ["EXPIRE", keys.browsers, expireSeconds],
    ["EXPIRE", keys.os, expireSeconds],
    ["EXPIRE", keys.countries, expireSeconds],
  ];
  await Promise.all(commands.map((command) => redisCommand(config, command, fetchImpl)));
}

export async function handleCollectPageView({ body, headers, env, now = new Date(), fetchImpl = fetch }) {
  const config = getAnalyticsConfig(env);
  const record = buildPageViewRecord({
    body,
    headers,
    now,
    salt: config.salt,
    timeZone: config.timeZone,
  });
  if (record.skipped) return { ok: true, skipped: true };
  if (!config.storageConfigured) {
    return { ok: false, skipped: false, error: { code: "ANALYTICS_STORAGE_NOT_CONFIGURED" } };
  }
  await recordPageView(config, record, fetchImpl);
  return { ok: true, skipped: false };
}

async function readDailySummary(config, date, fetchImpl) {
  const keys = analyticsKeys(config.keyPrefix, date);
  const [
    dayHash,
    visitors,
    pages,
    referrers,
    devices,
    browsers,
    os,
    countries,
  ] = await Promise.all([
    redisCommand(config, ["HGETALL", keys.day], fetchImpl),
    redisCommand(config, ["PFCOUNT", keys.visitors], fetchImpl),
    redisCommand(config, ["ZREVRANGE", keys.pages, 0, 9, "WITHSCORES"], fetchImpl),
    redisCommand(config, ["ZREVRANGE", keys.referrers, 0, 9, "WITHSCORES"], fetchImpl),
    redisCommand(config, ["ZREVRANGE", keys.devices, 0, 9, "WITHSCORES"], fetchImpl),
    redisCommand(config, ["ZREVRANGE", keys.browsers, 0, 9, "WITHSCORES"], fetchImpl),
    redisCommand(config, ["ZREVRANGE", keys.os, 0, 9, "WITHSCORES"], fetchImpl),
    redisCommand(config, ["ZREVRANGE", keys.countries, 0, 9, "WITHSCORES"], fetchImpl),
  ]);
  const parsed = parseRedisHash(dayHash);
  return {
    date,
    pageViews: Number(parsed.pageViews || 0),
    visitors: Number(visitors || 0),
    pages: parseRedisRankedPairs(pages),
    referrers: parseRedisRankedPairs(referrers),
    devices: parseRedisRankedPairs(devices),
    browsers: parseRedisRankedPairs(browsers),
    os: parseRedisRankedPairs(os),
    countries: parseRedisRankedPairs(countries),
  };
}

export async function handleAnalyticsSummary({ days = 30, env, now = new Date(), fetchImpl = fetch }) {
  const config = getAnalyticsConfig(env);
  if (!config.storageConfigured) {
    return {
      ok: false,
      error: { code: "ANALYTICS_STORAGE_NOT_CONFIGURED" },
      setup: {
        requiredEnv: [
          "ANALYTICS_KV_REST_API_URL or KV_REST_API_URL",
          "ANALYTICS_KV_REST_API_TOKEN or KV_REST_API_TOKEN",
          "ANALYTICS_ADMIN_TOKEN or HERMES_ADMIN_API_KEY",
        ],
      },
    };
  }

  const dates = buildSummaryDateKeys({ days, now, timeZone: config.timeZone });
  const daily = await Promise.all(dates.map((date) => readDailySummary(config, date, fetchImpl)));
  const totals = daily.reduce(
    (acc, item) => ({
      pageViews: acc.pageViews + item.pageViews,
      visitors: acc.visitors + item.visitors,
    }),
    { pageViews: 0, visitors: 0 },
  );

  return {
    ok: true,
    range: { days: dates.length, from: dates[0], to: dates[dates.length - 1] },
    totals,
    today: daily[daily.length - 1] || { pageViews: 0, visitors: 0 },
    daily: daily.map(({ date, pageViews, visitors }) => ({ date, pageViews, visitors })),
    topPages: mergeRankedMetrics(daily.map((item) => item.pages)),
    topReferrers: mergeRankedMetrics(daily.map((item) => item.referrers)),
    devices: mergeRankedMetrics(daily.map((item) => item.devices)),
    browsers: mergeRankedMetrics(daily.map((item) => item.browsers)),
    os: mergeRankedMetrics(daily.map((item) => item.os)),
    countries: mergeRankedMetrics(daily.map((item) => item.countries)),
  };
}
