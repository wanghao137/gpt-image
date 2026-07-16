const DEFAULT_ORIGIN = "https://youmind.com/zh-CN/prompts";
const HAN_RE = /\p{Script=Han}/u;

function findCreativeWork(value, id) {
  if (!value || typeof value !== "object") return null;
  if (
    value["@type"] === "CreativeWork" &&
    String(value["@id"] || value.url || "").includes(`-${id}`)
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCreativeWork(item, id);
      if (found) return found;
    }
    return null;
  }
  for (const item of Object.values(value)) {
    const found = findCreativeWork(item, id);
    if (found) return found;
  }
  return null;
}

export function decodeFlightChunks(html) {
  const chunks = [];
  const pattern = /self\.__next_f\.push\(\[1,("(?:\\[\s\S]|[^"\\])*")\]\)/g;
  for (const match of String(html || "").matchAll(pattern)) {
    try {
      chunks.push(JSON.parse(match[1]));
    } catch {
      // Ignore unrelated or incomplete flight chunks.
    }
  }
  return chunks.join("");
}

function readJsonStringProperty(source, property, startAt = 0) {
  const marker = `"${property}":`;
  const markerIndex = source.indexOf(marker, startAt);
  if (markerIndex < 0) return undefined;
  const quoteIndex = source.indexOf('"', markerIndex + marker.length);
  if (quoteIndex < 0) return undefined;

  let escaped = false;
  for (let index = quoteIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      try {
        return JSON.parse(source.slice(quoteIndex, index + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function readFlightTextRecord(source, reference) {
  const match = /^\$([0-9a-f]+)$/i.exec(String(reference || ""));
  if (!match) return reference;

  const marker = `${match[1]}:T`;
  let recordIndex = source.indexOf(`\n${marker}`);
  if (recordIndex >= 0) recordIndex += 1;
  else if (source.startsWith(marker)) recordIndex = 0;
  else recordIndex = source.indexOf(marker);
  if (recordIndex < 0) return undefined;

  const lengthStart = recordIndex + marker.length;
  const commaIndex = source.indexOf(",", lengthStart);
  if (commaIndex < 0) return undefined;
  const byteLength = Number.parseInt(source.slice(lengthStart, commaIndex), 16);
  if (!Number.isFinite(byteLength)) return undefined;

  const contentStart = commaIndex + 1;
  let contentEnd = contentStart;
  let bytesRead = 0;
  for (const char of source.slice(contentStart)) {
    const charBytes = new TextEncoder().encode(char).length;
    if (bytesRead + charBytes > byteLength) return undefined;
    bytesRead += charBytes;
    contentEnd += char.length;
    if (bytesRead === byteLength) return source.slice(contentStart, contentEnd);
  }
  return undefined;
}

export function extractYouMindLocalizedPrompt(html, promptId) {
  const id = String(promptId);
  let creativeWork = null;
  const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of String(html || "").matchAll(jsonLdPattern)) {
    try {
      creativeWork = findCreativeWork(JSON.parse(match[1]), id);
    } catch {
      creativeWork = null;
    }
    if (creativeWork) break;
  }

  const flight = decodeFlightChunks(html);
  const promptMarker = `"promptId":${id}`;
  const promptIndex = flight.indexOf(promptMarker);
  const promptValue = promptIndex >= 0
    ? readJsonStringProperty(flight, "translatedContent", promptIndex)
    : undefined;
  const prompt = readFlightTextRecord(flight, promptValue);
  const title = typeof creativeWork?.name === "string" ? creativeWork.name.trim() : "";
  const description = typeof creativeWork?.description === "string"
    ? creativeWork.description.trim()
    : "";

  if (!title || !prompt || !HAN_RE.test(title) || !HAN_RE.test(prompt)) return null;
  return { title, description, prompt: prompt.trim() };
}

export function selectLocaleRepairCandidates(items, locales, options = {}) {
  const windowSize = Math.max(1, Number(options.windowSize) || 500);
  const limit = Math.max(1, Number(options.limit) || 200);
  return [...(Array.isArray(items) ? items : [])]
    .filter((item) => /^\d+$/.test(String(item?.id || "")))
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, windowSize)
    .filter((item) => {
      const locale = locales instanceof Map ? locales.get(String(item.id)) : undefined;
      return !locale?.zh?.title || !locale?.zh?.prompt;
    })
    .slice(0, limit);
}

export async function fetchYouMindLocalizedPrompt(item, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const origin = String(options.origin || DEFAULT_ORIGIN).replace(/\/+$/, "");
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // YouMind resolves prompt detail pages by the stable numeric suffix; the
    // human-readable prefix is deliberately generic so title changes cannot
    // break locale recovery.
    const url = `${origin}/prompt-${encodeURIComponent(String(item.id))}`;
    const response = await fetchImpl(url, {
      headers: {
        "user-agent": "TaoStudio-Upstream-Sync/1.0",
        accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`fetch ${url} -> ${response.status}`);
    return extractYouMindLocalizedPrompt(await response.text(), item.id);
  } finally {
    clearTimeout(timer);
  }
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function repairRecentPromptLocales(items, locales, options = {}) {
  const candidates = selectLocaleRepairCandidates(items, locales, options);
  const output = new Map(locales instanceof Map ? locales : []);
  if (candidates.length === 0) {
    return { locales: output, attempted: 0, repaired: 0, failed: 0, skipped: 0 };
  }

  const fetchOne = (item) => fetchYouMindLocalizedPrompt(item, options);
  let first;
  try {
    first = await fetchOne(candidates[0]);
  } catch (error) {
    return {
      locales: output,
      attempted: 1,
      repaired: 0,
      failed: 1,
      skipped: candidates.length - 1,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  if (!first) {
    return {
      locales: output,
      attempted: 1,
      repaired: 0,
      failed: 1,
      skipped: candidates.length - 1,
      error: "localized detail page did not contain parseable Chinese content",
    };
  }

  const remaining = await mapConcurrent(
    candidates.slice(1),
    Number(options.concurrency) || 6,
    async (item) => {
      try {
        return { item, value: await fetchOne(item) };
      } catch (error) {
        return { item, error: error instanceof Error ? error.message : String(error) };
      }
    },
  );
  const results = [{ item: candidates[0], value: first }, ...remaining];
  let repaired = 0;
  let failed = 0;
  for (const result of results) {
    if (!result?.value) {
      failed += 1;
      continue;
    }
    const id = String(result.item.id);
    const current = output.get(id) || {};
    output.set(id, {
      ...current,
      en: current.en || {
        title: result.item.title || "",
        description: result.item.description || "",
        prompt: result.item.content || "",
      },
      zh: result.value,
    });
    repaired += 1;
  }
  return {
    locales: output,
    attempted: results.length,
    repaired,
    failed,
    skipped: candidates.length - results.length,
  };
}
