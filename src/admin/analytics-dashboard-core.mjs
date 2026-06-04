export function formatCompactNumber(value) {
  const number = Math.max(0, Number(value) || 0);
  if (number < 1000) return String(Math.round(number));
  if (number < 1000000) return `${(number / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(number / 1000000).toFixed(1).replace(/\.0$/, "")}m`;
}

export function chartMaxValue(daily = []) {
  const max = Math.max(
    0,
    ...daily.flatMap((item) => [Number(item.pageViews || 0), Number(item.visitors || 0)]),
  );
  return Math.max(1, max);
}

export function trendDelta(daily = [], metric = "pageViews") {
  const points = daily
    .map((item) => Number(item[metric] || 0))
    .filter((value) => value > 0);
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first) return null;
  return Math.round(((last - first) / first) * 100);
}

const LABELS = {
  referrer: {
    Direct: "直接访问",
    Internal: "站内跳转",
  },
  country: {
    CN: "中国",
    HK: "中国香港",
    MO: "中国澳门",
    TW: "中国台湾",
    US: "美国",
    JP: "日本",
    SG: "新加坡",
    KR: "韩国",
    GB: "英国",
  },
  device: {
    Desktop: "桌面端",
    Mobile: "手机端",
    Tablet: "平板端",
    Bot: "爬虫",
  },
  browser: {
    Chrome: "Chrome 浏览器",
    Safari: "Safari 浏览器",
    Edge: "Edge 浏览器",
    Firefox: "Firefox 浏览器",
    Opera: "Opera 浏览器",
    Other: "其他浏览器",
  },
  os: {
    Windows: "Windows",
    macOS: "macOS",
    iOS: "iOS",
    Android: "Android",
    Linux: "Linux",
    Other: "其他系统",
  },
};

export function formatAnalyticsMetricLabel(kind, label) {
  const value = String(label || "").trim();
  if (!value) return "未知";
  return LABELS[kind]?.[value] || value;
}

export function buildAnalyticsPlatformLinks() {
  return [
    { label: "Vercel Web Analytics", href: "https://vercel.com/dashboard", status: "代码已接入" },
    { label: "Vercel Speed Insights", href: "https://vercel.com/dashboard", status: "代码已接入" },
    {
      label: "Google Search Console",
      href: "https://search.google.com/search-console",
      status: "已验证，Sitemap 可提交",
    },
    { label: "Microsoft Clarity", href: "https://clarity.microsoft.com/", status: "可选行为分析" },
  ];
}

export function buildAnalyticsSetupChecklist(summary) {
  return (summary?.setup?.requiredEnv || []).map((label) => ({
    label,
    done: false,
  }));
}
