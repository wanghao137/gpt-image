const STATIC_PATH_PREFIXES = [
  "/admin",
  "/api",
  "/assets",
  "/brand",
  "/data",
  "/fonts",
  "/images",
  "/static-loader-data-manifest-",
  "/uploads",
];

const STATIC_PATHS = new Set([
  "/admin.html",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/og.png",
  "/og.svg",
  "/robots.txt",
  "/sitemap.xml",
]);

function parsePath(input) {
  if (!input || typeof input !== "string") return "/";
  if (!input.startsWith("/") && !/^https?:\/\//i.test(input)) return "/";
  try {
    const url = new URL(input, "https://taostudioai.com");
    return url.pathname || "/";
  } catch {
    return "/";
  }
}

export function normalizeAnalyticsPath(input) {
  const pathname = parsePath(input).replace(/\/{2,}/g, "/");
  if (pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function shouldTrackAnalyticsPath(input) {
  const path = normalizeAnalyticsPath(input);
  if (!path || STATIC_PATHS.has(path)) return false;
  return !STATIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function hasAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

export function classifyDevice(userAgent = "") {
  const ua = String(userAgent);
  if (hasAny(ua, [/bot/i, /crawler/i, /spider/i, /slurp/i])) return "Bot";
  if (hasAny(ua, [/ipad/i, /tablet/i])) return "Tablet";
  if (hasAny(ua, [/mobi/i, /iphone/i, /android/i])) return "Mobile";
  return "Desktop";
}

export function classifyBrowser(userAgent = "") {
  const ua = String(userAgent);
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua) || /Opera/i.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua) || /CriOS\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

export function classifyOS(userAgent = "") {
  const ua = String(userAgent);
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}

export function buildClientPageViewPayload({ href, referrer = "" }) {
  return {
    url: String(href || ""),
    path: normalizeAnalyticsPath(href),
    referrer: String(referrer || ""),
  };
}

export function toDateKey(date = new Date(), timeZone = "Asia/Shanghai") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function mergeRankedMetrics(groups, limit = 10) {
  const totals = new Map();
  for (const group of groups || []) {
    for (const item of group || []) {
      const label = String(item.label || "").trim();
      const value = Number(item.value || 0);
      if (!label || value <= 0) continue;
      totals.set(label, (totals.get(label) || 0) + value);
    }
  }
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}
