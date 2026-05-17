import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ORIGIN = "https://gpt-image2.canghe.ai";
const CASES_URL = `${ORIGIN}/cases.json`;
const STYLE_LIBRARY_URL = `${ORIGIN}/style-library.json`;
const OPTIONAL = process.argv.includes("--optional");
const MANUAL_CASES_PATH = resolve(ROOT, "data/manual/cases.json");
const MANUAL_TEMPLATES_PATH = resolve(ROOT, "data/manual/templates.json");

const CATEGORY_LABELS = {
  "Architecture & Spaces": "建筑与空间",
  "Brand & Logos": "品牌与标志",
  "Characters & People": "角色与人物",
  "Charts & Infographics": "图表与信息图",
  "Documents & Publishing": "文档与出版",
  "History & Classical Themes": "历史与古典",
  "Illustration & Art": "插画与艺术",
  "Other Use Cases": "其他用例",
  "Photography & Realism": "摄影与写实",
  "Posters & Typography": "海报与排版",
  "Products & E-commerce": "产品与电商",
  "Scenes & Storytelling": "场景与叙事",
  "UI & Interfaces": "UI 与界面",
};

function localize(value) {
  if (typeof value === "string") return value;
  return value?.zh || value?.en || "";
}

function localizeCategory(category) {
  return CATEGORY_LABELS[category] || category || "其他用例";
}

function absolutize(url) {
  if (!url) return "";
  return new URL(url, ORIGIN).toString();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "gpt-image-gallery-sync/1.0",
      accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`fetch ${url} -> ${response.status}`);
  return response.json();
}

function normalizeCase(item) {
  const styles = Array.isArray(item.styles) ? item.styles.filter(Boolean) : [];
  const scenes = Array.isArray(item.scenes) ? item.scenes.filter(Boolean) : [];
  return {
    id: String(item.id),
    title: item.title || `案例 ${item.id}`,
    category: localizeCategory(item.category),
    tags: [...new Set([...styles, ...scenes])].slice(0, 6),
    styles,
    scenes,
    imageUrl: absolutize(item.image),
    imageAlt: item.imageAlt || item.title || `案例 ${item.id}`,
    prompt: item.prompt || item.promptPreview || "",
    promptPreview: item.promptPreview || (item.prompt || "").slice(0, 220),
    source: item.sourceLabel || undefined,
    githubUrl: item.githubUrl || undefined,
  };
}

function buildTemplatePrompt(template) {
  const title = localize(template.title);
  const description = localize(template.description);
  const useWhen = localize(template.useWhen) || description;
  const direction = [
    ...new Set([
      ...(template.tags || []),
      ...(template.styles || []),
      ...(template.scenes || []),
    ]),
  ].join(" / ");
  const guidance = (template.guidance?.zh || template.guidance?.en || [])
    .map((line) => `- ${line}`)
    .join("\n");
  const pitfalls = (template.pitfalls?.zh || template.pitfalls?.en || [])
    .map((line) => `- ${line}`)
    .join("\n");

  return [
    `模板：${title}`,
    `用途：${useWhen}`,
    `视觉方向：${direction}`,
    "",
    "请基于以下结构生成一条可直接用于 GPT Image 2 的图片 Prompt：",
    "- 主体：[要生成的产品、人物、空间、界面或信息主题]",
    "- 场景：[使用环境、叙事背景、受众语境]",
    "- 构图：[画面比例、镜头距离、主体位置、层级关系]",
    "- 风格：[材质、光线、色彩、字体或渲染语言]",
    "- 约束：[必须出现/不能出现的元素、文字准确性、品牌限制]",
    guidance ? `\n使用建议：\n${guidance}` : "",
    pitfalls ? `\n防坑指南：\n${pitfalls}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeTemplate(template) {
  return {
    id: template.id,
    title: localize(template.title),
    category: localizeCategory(template.category),
    tags: template.tags || [],
    description: localize(template.description),
    cover: absolutize(template.cover),
    prompt: buildTemplatePrompt(template),
    useWhen: localize(template.useWhen),
  };
}

function writeJson(relativePath, data, opts = {}) {
  const output = resolve(ROOT, relativePath);
  mkdirSync(dirname(output), { recursive: true });
  // Compact (no pretty printing) for prod payload — keeps gzip output smaller too.
  const text = opts.pretty
    ? JSON.stringify(data, null, 2) + "\n"
    : JSON.stringify(data);
  writeFileSync(output, text, "utf8");
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
  return raw;
}

async function main() {
  console.log(`fetching ${CASES_URL} ...`);
  const casesPayload = await fetchJson(CASES_URL);
  const upstreamCases = (casesPayload.cases || [])
    .map(normalizeCase)
    .filter((item) => item.imageUrl && item.prompt);

  console.log(`fetching ${STYLE_LIBRARY_URL} ...`);
  const stylePayload = await fetchJson(STYLE_LIBRARY_URL);
  const upstreamTemplates = (stylePayload.templates || [])
    .map(normalizeTemplate)
    .filter((item) => item.id && item.prompt);

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
  // Sort numerically descending so newer/larger IDs (manual entries usually use
  // 100000+) appear at the top of the gallery.
  const fullCases = Array.from(caseMap.values()).sort(
    (a, b) => Number(b.id) - Number(a.id),
  );

  const templateMap = new Map();
  for (const t of upstreamTemplates) templateMap.set(t.id, t);
  for (const t of manualTemplates) {
    if (t && t.id) templateMap.set(t.id, t);
  }
  const templates = Array.from(templateMap.values());

  console.log(
    `merged: upstream ${upstreamCases.length} + manual ${manualCases.length} → ${fullCases.length} cases (${hiddenCount} hidden)`,
  );

  // Lite cases — strip the heavy `prompt` field. Card/grid only need `promptPreview`.
  const lite = fullCases.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    tags: c.tags,
    styles: c.styles,
    scenes: c.scenes,
    imageUrl: c.imageUrl,
    imageAlt: c.imageAlt,
    promptPreview: c.promptPreview,
    source: c.source,
    githubUrl: c.githubUrl,
  }));

  writeJson("public/data/cases.json", lite);
  console.log(`✓ wrote ${lite.length} lite records -> public/data/cases.json`);

  writeJson("public/data/templates.json", templates, { pretty: true });
  console.log(`✓ wrote ${templates.length} templates -> public/data/templates.json`);

  // Per-case prompts — fetched on demand when a user opens a case modal or copies.
  const promptsDir = resolve(ROOT, "public/data/prompts");
  if (existsSync(promptsDir)) rmSync(promptsDir, { recursive: true, force: true });
  mkdirSync(promptsDir, { recursive: true });
  for (const c of fullCases) {
    writeJson(`public/data/prompts/${c.id}.json`, { id: c.id, prompt: c.prompt });
  }
  console.log(`✓ wrote ${fullCases.length} per-case prompt files -> public/data/prompts/`);

  console.log(
    `synced ${fullCases.length} cases and ${templates.length} templates from GPT-Image2 public JSON.`,
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
