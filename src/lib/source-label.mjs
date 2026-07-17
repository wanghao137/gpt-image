const HOST_LABELS = new Map([
  ["github.com", "GitHub"],
  ["x.com", "X"],
  ["twitter.com", "X"],
  ["youmind.com", "YouMind"],
  ["cms-assets.youmind.com", "YouMind"],
]);

function hostLabel(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    return HOST_LABELS.get(host) || host;
  } catch {
    return "";
  }
}

export function sourceDisplayLabel(source = "", sourceUrl = "") {
  const raw = String(source || "").trim();
  const directUrl = hostLabel(raw);
  if (directUrl) return directUrl;
  const communityHandle = raw.match(/^Community collected via\s+(@\S+)$/i);
  if (communityHandle) return `社区整理 · ${communityHandle[1]}`;
  return raw || hostLabel(sourceUrl) || "来源待核对";
}
