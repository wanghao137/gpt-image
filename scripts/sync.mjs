import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ORIGIN = "https://gpt-image2.canghe.ai";
const CASES_URL = `${ORIGIN}/cases.json`;
const STYLE_LIBRARY_URL = `${ORIGIN}/style-library.json`;
const OPTIONAL = process.argv.includes("--optional");

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
    promptPreview: item.promptPreview || item.prompt || "",
    source: item.sourceLabel || undefined,
    githubUrl: item.githubUrl || undefined,
  };
}

function buildTemplatePrompt(template) {
  const title = localize(template.title);
  const description = localize(template.description);
  const useWhen = localize(template.useWhen) || description;
  const direction = [...new Set([...(template.tags || []), ...(template.styles || []), ...(template.scenes || [])])].join(" / ");
  const guidance = (template.guidance?.zh || template.guidance?.en || []).map((line) => `- ${line}`).join("\n");
  const pitfalls = (template.pitfalls?.zh || template.pitfalls?.en || []).map((line) => `- ${line}`).join("\n");

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

function writeJson(relativePath, data) {
  const output = resolve(ROOT, relativePath);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`✓ wrote ${Array.isArray(data) ? data.length : 1} records -> ${relativePath}`);
}

async function main() {
  console.log(`fetching ${CASES_URL} ...`);
  const casesPayload = await fetchJson(CASES_URL);
  const cases = (casesPayload.cases || [])
    .map(normalizeCase)
    .filter((item) => item.imageUrl && item.prompt)
    .sort((a, b) => Number(b.id) - Number(a.id));

  console.log(`fetching ${STYLE_LIBRARY_URL} ...`);
  const stylePayload = await fetchJson(STYLE_LIBRARY_URL);
  const templates = (stylePayload.templates || []).map(normalizeTemplate).filter((item) => item.id && item.prompt);

  writeJson("public/data/cases.json", cases);
  writeJson("public/data/templates.json", templates);

  console.log(`synced ${cases.length} cases and ${templates.length} templates from GPT-Image2 public JSON.`);
}

main().catch((error) => {
  if (OPTIONAL) {
    console.warn(`sync skipped: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(0);
  }

  console.error(error);
  process.exit(1);
});
