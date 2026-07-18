import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mergeTemplateCollections,
} from "./template-derivation.mjs";
import {
  applyUpstreamCaseTimestamps,
  inferContentDate,
  normalizedIsoDate,
  sortCasesForDisplay,
} from "./case-ordering.mjs";
import {
  mergePromptLocaleMaps,
  mergePromptLocales,
  promptLocaleMapFromObject,
  promptLocaleMapToObject,
  summarizePromptLocales,
} from "./upstream-locales.mjs";
import { repairRecentPromptLocales } from "./upstream-localized-pages.mjs";
import sharp from "sharp";
import { inferExplicitRatio, ratioFromDimensions } from "./ratio-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
// Upstream data lives at https://github.com/YouMind-OpenLab/gpt-image-2-prompts-search
// under `references/`. The repo publishes a manifest.json + one JSON file per
// category (11 files). We try a list of CDN/raw mirrors in order and keep the
// first one that responds for the manifest, then fetch all category files from
// it.
//
// Image URLs inside the data are already absolute (cms-assets.youmind.com/...),
// so no path resolution is needed.
//
// Override via env: `DATA_ORIGINS=base1,base2,...` (comma-separated, in order),
// or `DATA_ORIGIN=base` for a single source. Trailing slashes optional.
const DEFAULT_ORIGINS = [
  "https://cdn.jsdelivr.net/gh/YouMind-OpenLab/gpt-image-2-prompts-search@main/references",
  "https://raw.githubusercontent.com/YouMind-OpenLab/gpt-image-2-prompts-search/main/references",
];
const ORIGINS = (process.env.DATA_ORIGINS || process.env.DATA_ORIGIN || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const ORIGIN_LIST = ORIGINS.length > 0 ? ORIGINS : DEFAULT_ORIGINS;

const LOCALE_REPOSITORY_API =
  "https://api.github.com/repos/YouMind-OpenLab/awesome-gpt-image-2/commits/main";
const LOCALE_REPOSITORY_RAW =
  "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2";

const OPTIONAL = process.argv.includes("--optional");
const MANUAL_CASES_PATH = resolve(ROOT, "data/manual/cases.json");
const MANUAL_TEMPLATES_PATH = resolve(ROOT, "data/manual/templates.json");
const UPSTREAM_CASE_TIMES_PATH = resolve(ROOT, "data/upstream-case-times.json");
const OFFICIAL_LOCALES_PATH = resolve(ROOT, "data/upstream-locales.json");

// YouMind category slugs → Chinese labels. Used to populate the `category`
// field and feed the classifier (classify-core.mjs) as a scoring signal.
const CATEGORY_LABELS = {
  "profile-avatar": "头像与形象",
  "social-media-post": "社交媒体",
  "infographic-edu-visual": "信息图与教育",
  "youtube-thumbnail": "视频缩略图",
  "comic-storyboard": "漫画与分镜",
  "product-marketing": "产品营销",
  "ecommerce-main-image": "电商主图",
  "game-asset": "游戏资产",
  "poster-flyer": "海报与传单",
  "app-web-design": "应用与网页",
  others: "其他用例",
};

function localizeCategory(category) {
  return CATEGORY_LABELS[category] || category || "其他用例";
}

// YouMind prompts embed template placeholders like:
//   {argument name="theme" default="Blue Unraveling"}
// These are meant for a template engine, not a human reader. We replace each
// placeholder with its `default` value so the prompt reads naturally when a
// user opens a case detail or copies it. Placeholders without a default become
// the bare argument name.
function cleanPromptContent(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\{argument\s+name="([^"]+)"(?:\s+default="([^"]*)")?\s*\}/gi, (_m, name, fallback) =>
    fallback !== undefined ? fallback : name,
  );
}

// Set after we successfully fetch from one of the candidate origins. Used in
// the final log line.
let activeOrigin = ORIGIN_LIST[0];

async function fetchJson(url) {
  // Hard timeout so a hung CDN mirror fails fast and we fail over to the next
  // origin instead of stalling the build indefinitely. The YouMind upstream
  // files are larger (up to ~9 MB each), so we allow 60s per fetch.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "user-agent": "gpt-image-gallery-sync/1.0",
        accept: "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`fetch ${url} -> ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "user-agent": "gpt-image-gallery-sync/1.0",
        accept: "text/plain,text/markdown;q=0.9,*/*;q=0.1",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`fetch ${url} -> ${response.status}`);
  return response.text();
}

async function fetchOfficialLocales() {
  // Resolve main once, then pin both README requests to the exact same commit.
  // Reading mutable @main CDN files in parallel can mix two revisions and make
  // the English and Chinese ID windows disagree during an upstream update.
  const revisionPayload = await fetchJson(LOCALE_REPOSITORY_API);
  const revision = String(revisionPayload?.sha || "").trim();
  if (!/^[0-9a-f]{40}$/i.test(revision)) {
    throw new Error("awesome-gpt-image-2 main revision was unavailable");
  }
  const origin = `${LOCALE_REPOSITORY_RAW}/${revision}`;
  const [english, chinese] = await Promise.all([
    fetchText(`${origin}/README.md`),
    fetchText(`${origin}/README_zh.md`),
  ]);
  const locales = mergePromptLocales(english, chinese);
  const summary = summarizePromptLocales(locales);
  if (summary.chinese === 0) throw new Error(`no Chinese prompts parsed at ${revision}`);
  console.log(
    `loaded ${summary.bilingual}/${summary.total} pinned bilingual prompts ` +
    `from awesome-gpt-image-2@${revision.slice(0, 12)}`,
  );
  return locales;
}

/**
 * Try each origin in order; return merged data from the first origin that
 * successfully serves the manifest. The YouMind upstream is organized as one
 * manifest.json + 11 per-category JSON files. We fetch the manifest first,
 * then all category files, and de-duplicate by id (the same prompt can appear
 * under multiple categories).
 *
 * Returns `{ cases: [], origin }` — there is no style-library equivalent.
 */
async function fetchUpstream() {
  const errors = [];
  for (const origin of ORIGIN_LIST) {
    try {
      const manifestUrl = `${origin}/manifest.json`;
      console.log(`fetching ${manifestUrl} ...`);
      const manifest = await fetchJson(manifestUrl);
      if (!manifest || !Array.isArray(manifest.categories)) {
        throw new Error("manifest has no categories array");
      }

      // Fetch every category file concurrently. Each file is a flat array of
      // prompt records tagged with this category's slug.
      const categorySlugs = [];
      for (const cat of manifest.categories) {
        const slug = cat.slug || cat.file?.replace(/\.json$/, "");
        if (!slug) continue;
        categorySlugs.push(slug);
      }
      console.log(`manifest lists ${categorySlugs.length} categories, fetching ...`);

      const results = await Promise.all(
        categorySlugs.map(async (slug) => {
          const url = `${origin}/${slug}.json`;
          const records = await fetchJson(url);
          return { slug, records };
        }),
      );

      // Merge + de-duplicate by id. A prompt can appear under multiple
      // categories; we keep the first occurrence and merge its category slugs.
      const byId = new Map();
      for (const { slug, records } of results) {
        if (!Array.isArray(records)) continue;
        for (const item of records) {
          const id = String(item.id ?? "").trim();
          if (!id) continue;
          if (byId.has(id)) {
            // Already seen — just add this category slug.
            const existing = byId.get(id);
            if (Array.isArray(existing.categorySlugs)) {
              existing.categorySlugs.push(slug);
            }
          } else {
            byId.set(id, { ...item, categorySlugs: [slug] });
          }
        }
      }

      const mergedCases = Array.from(byId.values());
      console.log(
        `merged ${mergedCases.length} unique prompts from ${results.length} category files`,
      );

      activeOrigin = origin;
      return { casesPayload: { cases: mergedCases }, origin };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`! origin failed (${origin}): ${reason}`);
      errors.push(`${origin}: ${reason}`);
    }
  }
  throw new Error(`all upstream origins failed:\n  ${errors.join("\n  ")}`);
}

function normalizeCase(item, officialLocales) {
  // YouMind fields: id (number), content (full prompt with {argument} tags),
  // title, description, sourceMedia (array of absolute URLs), needReferenceImages.
  // categorySlugs is injected by fetchUpstream during merge.
  const official = officialLocales.get(String(item.id));
  const promptEn = cleanPromptContent(official?.en?.prompt || item.content || "");
  const promptZh = official?.zh?.prompt
    ? cleanPromptContent(official.zh.prompt)
    : undefined;
  const description = official?.zh?.description || item.description || "";
  const promptPreview = (description || promptZh || promptEn).slice(0, 100);
  const media = Array.isArray(item.sourceMedia) ? item.sourceMedia : [];
  const imageUrl = media.find((u) => typeof u === "string" && u) || "";
  // Use the first category slug the prompt appeared under as the primary
  // category signal for the classifier.
  const slug = Array.isArray(item.categorySlugs) ? item.categorySlugs[0] : item.category;
  // Use YouMind's own locale output when available. The generated README files
  // are built from the same CMS locale fields as the public bilingual page, so
  // we avoid lossy word-by-word translation. Cases not present in that curated
  // locale export keep their original English title instead of mixed Chinglish.
  const rawTitle = item.title || `案例 ${item.id}`;
  const titleZh = official?.zh?.title;
  const ratio = inferExplicitRatio(rawTitle, titleZh, description, promptEn, promptZh);
  return {
    id: String(item.id),
    title: titleZh || rawTitle,
    titleEn: titleZh ? rawTitle : undefined,
    category: localizeCategory(slug),
    tags: [],
    styles: [],
    scenes: [],
    imageUrl,
    imageAlt: titleZh || rawTitle,
    prompt: promptEn,
    promptEn,
    promptZh,
    promptPreview,
    source: "YouMind",
    githubUrl: undefined,
    createdAt: inferContentDate(item),
    ratio: ratio || undefined,
  };
}

async function detectRemoteRatio(imageUrl) {
  if (!imageUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const proxyUrl = new URL("https://wsrv.nl/");
    proxyUrl.searchParams.set("url", imageUrl.replace(/^https?:\/\//i, ""));
    proxyUrl.searchParams.set("w", "64");
    proxyUrl.searchParams.set("output", "webp");
    const response = await fetch(proxyUrl, {
      headers: { "user-agent": "gpt-image-gallery-sync/1.0", accept: "image/*" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    return ratioFromDimensions(metadata.width, metadata.height);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function enrichNewCaseRatios(cases, cachedCaseById, concurrency = 8) {
  const pending = cases.filter(
    (item) => !cachedCaseById.get(String(item.id))?.imageRatio,
  );
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= pending.length) return;
      const item = pending[index];
      item.imageRatio = (await detectRemoteRatio(item.imageUrl)) || undefined;
    }
  });
  await Promise.all(workers);
  if (pending.length > 0) {
    const resolved = pending.filter((item) => item.imageRatio).length;
    console.log(`resolved real image ratios for ${resolved}/${pending.length} new cases`);
  }
}

function writeJson(relativePath, data, opts = {}) {
  const output = resolve(ROOT, relativePath);
  mkdirSync(dirname(output), { recursive: true });
  // Compact (no pretty printing) for prod payload — keeps gzip output smaller too.
  const text = opts.pretty
    ? JSON.stringify(data, null, 2) + "\n"
    : JSON.stringify(data);
  writeFileWithRetry(output, text, "utf8");
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function writeFileWithRetry(path, data, encoding = "utf8") {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      writeFileSync(path, data, encoding);
      return;
    } catch (error) {
      const code = error?.code;
      if (!["UNKNOWN", "EBUSY", "EPERM", "EACCES"].includes(code) || attempt === 7) {
        throw error;
      }
      sleepSync(75 * (attempt + 1));
    }
  }
}

function readJsonSafe(absolutePath, fallback) {
  if (!existsSync(absolutePath)) return fallback;
  try {
    const raw = readFileSync(absolutePath, "utf8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`! could not parse ${absolutePath}: ${error.message}`);
    return fallback;
  }
}

function sortTemplatesForDisplay(templates) {
  return templates
    .map((item, index) => {
      const iso = normalizedIsoDate(item?.createdAt);
      return {
        item,
        index,
        time: iso ? Date.parse(iso) : null,
      };
    })
    .sort((a, b) => {
      const aManual = a.item.sourceType === "manual";
      const bManual = b.item.sourceType === "manual";
      if (aManual !== bManual) return aManual ? -1 : 1;

      if (aManual && bManual) {
        const aHasDate = a.time !== null;
        const bHasDate = b.time !== null;
        if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;
        if (a.time !== null && b.time !== null && a.time !== b.time) {
          return b.time - a.time;
        }
      }

      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/**
 * Normalize a manual case authored in `data/manual/cases.json`.
 * Manual entries follow the same shape as upstream JSON but the user only has
 * to fill the meaningful fields — we backfill the rest.
 */
function normalizeManualCase(item) {
  const id = String(item.id ?? "").trim();
  if (!id) return null;
  const styles = Array.isArray(item.styles) ? item.styles.filter(Boolean) : [];
  const scenes = Array.isArray(item.scenes) ? item.scenes.filter(Boolean) : [];
  const fallbackTags = [...new Set([...styles, ...scenes])].slice(0, 6);
  const prompt = (item.prompt ?? "").toString();
  return {
    id,
    title: item.title || `案例 ${id}`,
    category: item.category || "其他用例",
    tags: Array.isArray(item.tags) && item.tags.length > 0 ? item.tags : fallbackTags,
    styles,
    scenes,
    imageUrl: item.imageUrl || "",
    imageAlt: item.imageAlt || item.title || `案例 ${id}`,
    prompt,
    promptPreview: item.promptPreview || prompt.slice(0, 220),
    source: item.source || undefined,
    githubUrl: item.githubUrl || undefined,
    createdAt: inferContentDate(item),
    ratio: item.ratio || undefined,
    imageRatio: item.imageRatio || undefined,
    hidden: Boolean(item.hidden),
  };
}

function loadManualCases() {
  const raw = readJsonSafe(MANUAL_CASES_PATH, []);
  if (!Array.isArray(raw)) {
    console.warn("! data/manual/cases.json is not an array, ignoring");
    return [];
  }
  return raw.map(normalizeManualCase).filter(Boolean);
}

function loadManualTemplates() {
  const raw = readJsonSafe(MANUAL_TEMPLATES_PATH, []);
  if (!Array.isArray(raw)) {
    console.warn("! data/manual/templates.json is not an array, ignoring");
    return [];
  }
  return raw.map(normalizeManualTemplate).filter(Boolean);
}

function normalizeManualTemplate(item) {
  if (!item?.id) return null;
  return {
    ...item,
    createdAt: inferContentDate(item),
  };
}

async function main() {
  let upstreamCases = [];
  let upstreamOk = true;
  const cachedCasesBeforeSync = readJsonSafe(resolve(ROOT, "public/data/cases.json"), []);
  const cachedCaseById = new Map(
    (Array.isArray(cachedCasesBeforeSync) ? cachedCasesBeforeSync : []).map((item) => [
      String(item.id),
      item,
    ]),
  );
  const cachedOfficialLocales = promptLocaleMapFromObject(
    readJsonSafe(OFFICIAL_LOCALES_PATH, {}),
  );
  let officialLocales = new Map(cachedOfficialLocales);

  try {
    officialLocales = mergePromptLocaleMaps(
      cachedOfficialLocales,
      await fetchOfficialLocales(),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (officialLocales.size > 0) {
      console.warn(
        `! official bilingual refresh unavailable; using ${officialLocales.size} cached prompts: ${reason}`,
      );
    } else {
      console.warn(`! official bilingual content unavailable; keeping original English: ${reason}`);
    }
  }

  try {
    const { casesPayload } = await fetchUpstream();
    const rawUpstreamCases = casesPayload.cases || [];
    const repaired = await repairRecentPromptLocales(rawUpstreamCases, officialLocales, {
      origin: process.env.YOUMIND_LOCALE_DETAIL_ORIGIN,
      windowSize: process.env.LOCALE_REPAIR_WINDOW,
      limit: process.env.LOCALE_REPAIR_LIMIT,
      concurrency: process.env.LOCALE_REPAIR_CONCURRENCY,
      timeoutMs: process.env.LOCALE_REPAIR_TIMEOUT_MS,
    });
    officialLocales = repaired.locales;
    if (repaired.repaired > 0) {
      console.log(
        `recovered ${repaired.repaired}/${repaired.attempted} recent Chinese prompts ` +
        `from public YouMind detail pages`,
      );
    } else if (repaired.error) {
      console.warn(
        `! public YouMind locale recovery unavailable; skipped ${repaired.skipped}: ${repaired.error}`,
      );
    }
    writeJson(
      "data/upstream-locales.json",
      promptLocaleMapToObject(officialLocales),
      { pretty: true },
    );
    upstreamCases = rawUpstreamCases
      .map((item) => normalizeCase(item, officialLocales))
      .filter((item) => item.imageUrl && item.prompt);
    await enrichNewCaseRatios(upstreamCases, cachedCaseById);
  } catch (error) {
    upstreamOk = false;
    if (!OPTIONAL) throw error;

    // Optional mode: keep building. Fall back to whatever's already committed
    // under public/data/ so the site still loads, and let the manual area
    // continue to override entries normally.
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`! upstream unavailable, using cached public/data: ${reason}`);

    const cachedCases = readJsonSafe(resolve(ROOT, "public/data/cases.json"), []);
    if (Array.isArray(cachedCases)) {
      // Cached cases are LITE (no `prompt`). That's fine — the merge below
      // only needs the visible card fields. Per-case prompt files for these
      // ids are also already on disk from the previous successful sync.
      //
      // IMPORTANT: strip any IDs in the manual range (>= 100000) — those
      // are stale manual entries that got baked into a previous snapshot.
      // Manual gets re-applied fresh from data/manual/cases.json below, so
      // keeping them here would leave deleted/renamed entries lingering.
      upstreamCases = cachedCases.filter(
        (c) => c.imageUrl && Number(c.id) < 100000,
      );
    }
  }

  const upstreamCaseTimes = readJsonSafe(UPSTREAM_CASE_TIMES_PATH, {});
  const timestampedUpstream = applyUpstreamCaseTimestamps(
    upstreamCases,
    upstreamCaseTimes,
    { stampMissing: upstreamOk },
  );
  upstreamCases = timestampedUpstream.cases;

  // --- Merge in manually-authored content from data/manual/ ---
  const manualCases = loadManualCases();
  const manualTemplates = loadManualTemplates();

  // Build a map keyed by ID. Manual entries override upstream when IDs collide,
  // and a manual entry with `hidden: true` removes the upstream entry entirely.
  const caseMap = new Map();
  for (const c of upstreamCases) caseMap.set(c.id, c);
  let hiddenCount = 0;
  for (const c of manualCases) {
    if (c.hidden) {
      if (caseMap.delete(c.id)) hiddenCount += 1;
      continue;
    }
    if (!c.imageUrl || !c.prompt) {
      console.warn(`! manual case "${c.id}" missing imageUrl or prompt — skipped`);
      continue;
    }
    caseMap.set(c.id, c);
  }
  // Sort by actual content recency across both sources. Upstream GitHub cases
  // do not publish createdAt today, so `data/upstream-case-times.json` stores
  // when each upstream id first appeared in our daily sync.
  const fullCases = sortCasesForDisplay(Array.from(caseMap.values()));

  // The YouMind upstream has no style-library, so templates come only from
  // manual data here. The derive step (migrate-v2.mjs) later adds templates
  // derived from the merged case library.
  const templates = sortTemplatesForDisplay(
    mergeTemplateCollections({
      upstreamTemplates: [],
      derivedTemplates: [],
      manualTemplates,
    }),
  );

  console.log(
    `merged: upstream ${upstreamCases.length} + manual ${manualCases.length} → ${fullCases.length} cases (${hiddenCount} hidden)`,
  );
  console.log(
    `templates: manual ${manualTemplates.length} → ${templates.length} templates`,
  );

  // Lite cases — strip fields not needed for card/grid rendering.
  // `prompt` is in per-case prompt files (lazy-loaded). `imageAlt` is omitted
  // because every consumer falls back to `title`. `githubUrl` only appears on
  // manual cases (upstream YouMind has none), so we only include it when set.
  // Empty tag/style/scene arrays are omitted to avoid the `"tags":[]` overhead
  // across 12K+ records where 98% are empty.
  const lite = fullCases.map((c) => {
    const cached = cachedCaseById.get(String(c.id));
    const row = {
      id: c.id,
      title: c.title,
      category: c.category,
      imageUrl: c.imageUrl,
      promptPreview: c.promptPreview,
      source: c.source,
      createdAt: c.createdAt,
    };
    // Slugs are permanent URLs. A title/translation refresh must never rewrite
    // thousands of existing links; only new cases let migrate-v2 create one.
    if (c.slug || cached?.slug) row.slug = c.slug || cached.slug;
    if (c.titleEn) row.titleEn = c.titleEn;
    // Only include arrays when they have content.
    if (c.tags?.length) row.tags = c.tags;
    if (c.styles?.length) row.styles = c.styles;
    if (c.scenes?.length) row.scenes = c.scenes;
    if (c.githubUrl) row.githubUrl = c.githubUrl;
    if (c.ratio || cached?.ratio) row.ratio = c.ratio || cached.ratio;
    if (c.imageRatio || cached?.imageRatio) row.imageRatio = c.imageRatio || cached.imageRatio;
    return row;
  });

  writeJson("public/data/cases.json", lite);
  console.log(`✓ wrote ${lite.length} lite records -> public/data/cases.json`);

  if (upstreamOk) {
    writeJson("data/upstream-case-times.json", timestampedUpstream.timestamps, { pretty: true });
    console.log(
      `✓ wrote ${Object.keys(timestampedUpstream.timestamps).length} upstream timestamps -> data/upstream-case-times.json`,
    );
  }

  writeJson("public/data/templates.json", templates, { pretty: true });
  console.log(`✓ wrote ${templates.length} templates -> public/data/templates.json`);

  // Per-case prompts — fetched on demand when a user opens a case modal or copies.
  //
  // INCREMENTAL UPDATE: instead of nuking the whole prompts/ directory on every
  // sync (which caused massive git diffs from 12K+ file mtime churn), we now:
  //   1. Build a map of id→prompt from the current full cases.
  //   2. Compare against existing files on disk — only write when content changed.
  //   3. Delete orphaned files (id no longer in the current case set).
  // This keeps the prompts/ directory byte-stable across daily syncs when the
  // upstream only adds a few new prompts, avoiding git repo bloat.
  const promptsDir = resolve(ROOT, "public/data/prompts");
  mkdirSync(promptsDir, { recursive: true });

  // Build the authoritative id→prompt payload map from current cases.
  const promptMap = new Map();
  for (const c of fullCases) {
    const prompt = c.promptEn || c.prompt;
    if (!prompt) continue;
    const payload = { id: c.id, prompt };
    if (c.promptZh) {
      payload.promptEn = prompt;
      payload.promptZh = c.promptZh;
    }
    promptMap.set(c.id, payload);
  }

  // Sweep existing files: update changed, delete orphans.
  let writtenPrompts = 0;
  let unchangedPrompts = 0;
  let deletedPrompts = 0;
  if (existsSync(promptsDir)) {
    for (const file of readdirSync(promptsDir)) {
      const id = file.replace(/\.json$/i, "");
      const filePath = resolve(promptsDir, file);
      if (!promptMap.has(id)) {
        if (!upstreamOk && Number(id) < 100000) {
          unchangedPrompts += 1;
          continue;
        }
        // Orphaned file — case was removed from upstream or manual hidden.
        rmSync(filePath, { force: true });
        deletedPrompts += 1;
        continue;
      }
      // Check if content changed before writing.
      const expected = JSON.stringify(promptMap.get(id));
      try {
        const existing = readFileSync(filePath, "utf8");
        if (existing === expected) {
          unchangedPrompts += 1;
          promptMap.delete(id); // already up-to-date, skip re-write
        }
      } catch {
        // Read error — will be overwritten below.
      }
    }
  }

  // Write only new or changed prompts.
  for (const [id, payload] of promptMap) {
    writeJson(`public/data/prompts/${id}.json`, payload);
    writtenPrompts += 1;
  }
  console.log(
    `✓ prompts: ${writtenPrompts} written, ${unchangedPrompts} unchanged, ${deletedPrompts} deleted ` +
      `-> public/data/prompts/${upstreamOk ? "" : " (manual only — upstream offline)"}`,
  );

  console.log(
    upstreamOk
      ? `synced ${fullCases.length} cases and ${templates.length} templates from ${activeOrigin}.`
      : `built ${fullCases.length} cases and ${templates.length} templates from cached snapshot + manual.`,
  );
}

main().catch((error) => {
  if (OPTIONAL) {
    console.warn(`sync skipped: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(0);
  }

  console.error(error);
  process.exit(1);
});
