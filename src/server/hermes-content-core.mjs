import { Buffer } from "node:buffer";
import { createHash, timingSafeEqual } from "node:crypto";
import { posix as pathPosix } from "node:path";
import {
  inferCaseFields,
  inferTemplateFields,
} from "../admin/content-automation-core.mjs";

const GITHUB_API = "https://api.github.com";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Defence-in-depth limits on a single request. The endpoint holds a repo-write
// token, so we bound how much one (authorised) call can push: cap the number
// of uploads and the combined decoded image payload. Without these a single
// request could attach an unbounded number of 10 MB images and balloon the
// commit / function memory.
const MAX_UPLOADS_PER_REQUEST = 8;
const MAX_TOTAL_UPLOAD_BYTES = 24 * 1024 * 1024;
const UPLOAD_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const PATHS = {
  cases: "data/manual/cases.json",
  templates: "data/manual/templates.json",
};

const CATEGORIES = new Set([
  "建筑与空间",
  "品牌与标志",
  "角色与人物",
  "图表与信息图",
  "文档与出版",
  "历史与古典",
  "插画与艺术",
  "其他用例",
  "摄影与写实",
  "海报与排版",
  "产品与电商",
  "场景与叙事",
  "UI 与界面",
]);

const TEMPLATE_SOURCE_TYPES = new Set(["upstream-style", "derived-case", "manual"]);

function encodeGitHubPath(path) {
  return String(path)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export class HermesContentError extends Error {
  constructor(status, message, code = "HERMES_CONTENT_ERROR", details) {
    super(message);
    this.name = "HermesContentError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function text(value) {
  return String(value ?? "").trim();
}

function headerValue(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const lower = name.toLowerCase();
  return headers[lower] || headers[name] || "";
}

function providedApiKey(req) {
  const auth = text(headerValue(req?.headers, "authorization"));
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return bearer.trim();
  return text(headerValue(req?.headers, "x-hermes-api-key"));
}

function constantTimeEqual(a, b) {
  if (!a || !b) return false;
  const left = createHash("sha256").update(String(a)).digest();
  const right = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(left, right);
}

export function getHermesApiKey(env = process.env) {
  const key = text(env.HERMES_ADMIN_API_KEY);
  if (!key) {
    throw new HermesContentError(
      500,
      "HERMES_ADMIN_API_KEY is not configured",
      "CONFIG_MISSING",
    );
  }
  return key;
}

export function isAuthorizedHermesRequest(req, expectedApiKey) {
  return constantTimeEqual(providedApiKey(req), expectedApiKey);
}

export function getHermesGitHubConfig(env = process.env) {
  const token = text(env.HERMES_GITHUB_TOKEN);
  if (!token) {
    throw new HermesContentError(
      500,
      "HERMES_GITHUB_TOKEN is not configured",
      "CONFIG_MISSING",
    );
  }
  return {
    owner: text(env.HERMES_REPO_OWNER) || "wanghao137",
    repo: text(env.HERMES_REPO_NAME) || "gpt-image",
    branch: text(env.HERMES_REPO_BRANCH) || "main",
    token,
  };
}

function parseArrayJson(source, path) {
  const raw = text(source);
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new HermesContentError(
      500,
      `${path} is not valid JSON`,
      "SOURCE_JSON_INVALID",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!Array.isArray(parsed)) {
    throw new HermesContentError(500, `${path} must be a JSON array`, "SOURCE_JSON_INVALID");
  }
  return parsed;
}

function serializeArray(items) {
  return `${JSON.stringify(items, null, 2)}\n`;
}

function normalizeList(value, field) {
  if (value == null) return [];
  const values = Array.isArray(value) ? value : String(value).split(",");
  const out = [];
  const seen = new Set();
  for (const entry of values) {
    const next = text(entry);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  if (!Array.isArray(value) && String(value).includes("\n")) {
    throw new HermesContentError(422, `${field} must be an array or comma-separated text`);
  }
  return out;
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HermesContentError(422, `${label} must be an object`);
  }
  return value;
}

function requireText(obj, field) {
  const value = text(obj[field]);
  if (!value) throw new HermesContentError(422, `${field} is required`);
  return value;
}

function validateCategory(category) {
  if (!CATEGORIES.has(category)) {
    throw new HermesContentError(422, `category is invalid: ${category}`);
  }
}

function nextCaseId(cases) {
  let max = 100000;
  for (const item of cases) {
    const id = Number(item?.id);
    if (Number.isFinite(id) && id >= 100000 && id > max) max = id;
  }
  return String(max + 1);
}

function upsertById(items, item) {
  const id = text(item.id);
  const index = items.findIndex((entry) => text(entry?.id) === id);
  if (index === -1) return [item, ...items];
  return items.map((entry, i) => (i === index ? item : entry));
}

function validateBase64(value, label) {
  const withoutDataUrl = text(value).replace(/^data:[^,]+;base64,/i, "");
  const normalized = withoutDataUrl.replace(/\s+/g, "");
  if (!normalized) throw new HermesContentError(422, `${label} is required`);
  if (normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new HermesContentError(422, `${label} must be valid base64`);
  }
  const bytes = Buffer.from(normalized, "base64");
  if (!bytes.length) throw new HermesContentError(422, `${label} must not be empty`);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new HermesContentError(422, `${label} exceeds ${MAX_UPLOAD_BYTES} bytes`);
  }
  return { normalized, byteLength: bytes.byteLength };
}

function normalizeUploadPath(value) {
  const raw = text(value);
  if (!raw) throw new HermesContentError(422, "upload path is required");
  if (raw.includes("\\") || raw.includes("\0")) {
    throw new HermesContentError(422, "upload path must use forward slashes");
  }
  const candidate = raw.startsWith("/uploads/")
    ? `public${raw}`
    : raw.replace(/^\/+/, "");
  const normalized = pathPosix.normalize(candidate);
  if (
    normalized !== candidate ||
    !normalized.startsWith("public/uploads/") ||
    normalized === "public/uploads"
  ) {
    throw new HermesContentError(422, "uploads must stay under public/uploads");
  }
  const ext = pathPosix.extname(normalized).toLowerCase();
  if (!UPLOAD_EXTENSIONS.has(ext)) {
    throw new HermesContentError(422, `upload extension is not allowed: ${ext || "(none)"}`);
  }
  return normalized;
}

function normalizeUploads(uploads) {
  if (uploads == null) return [];
  if (!Array.isArray(uploads)) {
    throw new HermesContentError(422, "uploads must be an array");
  }
  if (uploads.length > MAX_UPLOADS_PER_REQUEST) {
    throw new HermesContentError(
      422,
      `uploads must not exceed ${MAX_UPLOADS_PER_REQUEST} files per request`,
    );
  }
  let totalBytes = 0;
  const seenPaths = new Set();
  const normalized = uploads.map((upload, index) => {
    const item = requireObject(upload, `uploads[${index}]`);
    const path = normalizeUploadPath(item.path);
    if (seenPaths.has(path)) {
      throw new HermesContentError(422, `duplicate upload path: ${path}`);
    }
    seenPaths.add(path);
    const { normalized: content, byteLength } = validateBase64(
      item.contentBase64,
      `uploads[${index}].contentBase64`,
    );
    totalBytes += byteLength;
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
      throw new HermesContentError(
        422,
        `combined uploads exceed ${MAX_TOTAL_UPLOAD_BYTES} bytes`,
      );
    }
    return { path, content, encoding: "base64" };
  });
  return normalized;
}

function uploadPathToPublicUrl(path) {
  return `/${path.replace(/^public\//, "")}`;
}

function optionalText(obj, field) {
  if (!obj) return undefined;
  const value = text(obj[field]);
  return value || undefined;
}

function prepareCaseItem(input, cases, uploads) {
  const item = requireObject(input, "item");
  if (item.hidden === true) {
    return { id: requireText(item, "id"), hidden: true };
  }

  const title = requireText(item, "title");
  const category = requireText(item, "category");
  validateCategory(category);

  const imageUrl = text(item.imageUrl) || (uploads.length === 1 ? uploadPathToPublicUrl(uploads[0].path) : "");
  if (!imageUrl) throw new HermesContentError(422, "imageUrl is required");
  const id = optionalText(item, "id") || nextCaseId(cases);
  const existing = cases.find((entry) => text(entry?.id) === id);

  const next = inferCaseFields(
    {
      id,
      title,
      category,
      styles: normalizeList(item.styles, "styles"),
      scenes: normalizeList(item.scenes, "scenes"),
      tags: item.tags == null ? undefined : normalizeList(item.tags, "tags"),
      imageUrl,
      imageAlt: optionalText(item, "imageAlt"),
      prompt: requireText(item, "prompt"),
      promptPreview: optionalText(item, "promptPreview"),
      source: optionalText(item, "source"),
      githubUrl: optionalText(item, "githubUrl"),
      createdAt: optionalText(item, "createdAt") || optionalText(existing, "createdAt") || new Date().toISOString(),
    },
    { overwrite: false },
  );

  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
}

function prepareTemplateItem(input, templates) {
  const item = requireObject(input, "item");
  const id = requireText(item, "id");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new HermesContentError(422, "template id must be kebab-case English");
  }

  const category = requireText(item, "category");
  validateCategory(category);

  const sourceType = optionalText(item, "sourceType");
  if (sourceType && !TEMPLATE_SOURCE_TYPES.has(sourceType)) {
    throw new HermesContentError(422, `sourceType is invalid: ${sourceType}`);
  }
  const existing = templates.find((entry) => text(entry?.id) === id);
  const templateCreatedAt = optionalText(item, "createdAt") || optionalText(existing, "createdAt") || new Date().toISOString();

  const next = inferTemplateFields(
    {
      id,
      title: requireText(item, "title"),
      category,
      tags: normalizeList(item.tags, "tags"),
      description: text(item.description),
      cover: requireText(item, "cover"),
      prompt: requireText(item, "prompt"),
      useWhen: text(item.useWhen),
      createdAt: templateCreatedAt,
      sourceType: sourceType || undefined,
      sourceLabel: optionalText(item, "sourceLabel"),
      sourceUrl: optionalText(item, "sourceUrl"),
      derivedFrom: item.derivedFrom == null ? undefined : normalizeList(item.derivedFrom, "derivedFrom"),
    },
    { overwrite: false },
  );

  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
}

export function buildHermesContentUpdate({ body, casesText, templatesText }) {
  const request = requireObject(body, "body");
  const kind = text(request.kind);
  const action = text(request.action) || "upsert";
  if (!["case", "template"].includes(kind)) {
    throw new HermesContentError(422, "kind must be case or template");
  }
  if (action !== "upsert") {
    throw new HermesContentError(422, "action must be upsert");
  }

  const cases = parseArrayJson(casesText, PATHS.cases);
  const templates = parseArrayJson(templatesText, PATHS.templates);
  const uploads = normalizeUploads(request.uploads);

  if (kind === "case") {
    const item = prepareCaseItem(request.item, cases, uploads);
    const nextCases = upsertById(cases, item);
    return {
      summary: {
        kind,
        action,
        id: item.id,
        title: item.title || `hidden case ${item.id}`,
        changedFiles: [PATHS.cases, ...uploads.map((upload) => upload.path)],
      },
      files: [
        { path: PATHS.cases, content: serializeArray(nextCases), encoding: "utf-8" },
        ...uploads,
      ],
    };
  }

  const item = prepareTemplateItem(request.item, templates);
  const nextTemplates = upsertById(templates, item);
  return {
    summary: {
      kind,
      action,
      id: item.id,
      title: item.title,
      changedFiles: [PATHS.templates, ...uploads.map((upload) => upload.path)],
    },
    files: [
      { path: PATHS.templates, content: serializeArray(nextTemplates), encoding: "utf-8" },
      ...uploads,
    ],
  };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubJson(fetchImpl, url, init = {}) {
  const response = await fetchImpl(url, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new HermesContentError(
      response.status || 500,
      `GitHub API request failed: ${response.statusText || response.status}`,
      "GITHUB_API_ERROR",
      detail.slice(0, 500),
    );
  }
  return response.json();
}

export async function readGitHubTextFile({
  fetchImpl = fetch,
  owner,
  repo,
  branch,
  token,
  path,
}) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeGitHubPath(
    path,
  )}?ref=${encodeURIComponent(branch)}`;
  const response = await fetchImpl(url, { headers: githubHeaders(token) });
  if (response.status === 404) return "[]\n";
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new HermesContentError(
      response.status || 500,
      `Read ${path} failed: ${response.statusText || response.status}`,
      "GITHUB_API_ERROR",
      detail.slice(0, 500),
    );
  }
  const json = await response.json();
  if (json.encoding !== "base64") {
    throw new HermesContentError(500, `Unexpected GitHub encoding for ${path}`);
  }
  return Buffer.from(String(json.content || "").replace(/\s+/g, ""), "base64").toString("utf8");
}

export async function commitFilesToGitHub({
  fetchImpl = fetch,
  owner,
  repo,
  branch,
  token,
  message,
  files,
}) {
  if (!files?.length) {
    throw new HermesContentError(422, "No files to commit");
  }
  const base = `${GITHUB_API}/repos/${owner}/${repo}`;
  const headers = githubHeaders(token);
  const ref = await githubJson(fetchImpl, `${base}/git/ref/heads/${encodeURIComponent(branch)}`, {
    headers,
  });
  const headSha = ref.object?.sha;
  if (!headSha) throw new HermesContentError(500, "GitHub ref response missing head sha");

  const headCommit = await githubJson(fetchImpl, `${base}/git/commits/${headSha}`, { headers });
  const baseTree = headCommit.tree?.sha;
  if (!baseTree) throw new HermesContentError(500, "GitHub commit response missing tree sha");

  const tree = [];
  for (const file of files) {
    const path = text(file.path);
    if (!path || path.startsWith("/") || path.includes("\\") || path.includes("..")) {
      throw new HermesContentError(422, `Invalid commit path: ${path}`);
    }
    const encoding = file.encoding === "base64" ? "base64" : "utf-8";
    const blob = await githubJson(fetchImpl, `${base}/git/blobs`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        content: String(file.content ?? ""),
        encoding,
      }),
    });
    tree.push({
      path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  const newTree = await githubJson(fetchImpl, `${base}/git/trees`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: baseTree, tree }),
  });

  const commit = await githubJson(fetchImpl, `${base}/git/commits`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: text(message) || "content(api): update Hermes content",
      tree: newTree.sha,
      parents: [headSha],
    }),
  });

  let commitRef;
  try {
    commitRef = await githubJson(
      fetchImpl,
      `${base}/git/refs/heads/${encodeURIComponent(branch)}`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ sha: commit.sha, force: false }),
      },
    );
  } catch (error) {
    // A non-fast-forward PATCH means another writer (the daily sync action, or
    // a browser-admin commit) advanced `main` between our HEAD read and this
    // update. Surface a dedicated, retriable code instead of a bare 500 so the
    // Hermes automation can re-read HEAD and retry rather than treating it as a
    // hard failure. GitHub returns 422 for this case.
    if (error instanceof HermesContentError && error.status === 422) {
      throw new HermesContentError(
        409,
        "Branch moved during commit (non-fast-forward). Re-read HEAD and retry.",
        "REF_CONFLICT",
        error.details,
      );
    }
    throw error;
  }
  void commitRef;

  return {
    commitSha: commit.sha,
    commitUrl: commit.html_url,
    files: files.map((file) => file.path),
  };
}

export async function handleHermesContentRequest({
  body,
  env = process.env,
  fetchImpl = fetch,
}) {
  const github = getHermesGitHubConfig(env);
  const [casesText, templatesText] = await Promise.all([
    readGitHubTextFile({ fetchImpl, ...github, path: PATHS.cases }),
    readGitHubTextFile({ fetchImpl, ...github, path: PATHS.templates }),
  ]);
  const update = buildHermesContentUpdate({ body, casesText, templatesText });
  if (body?.dryRun) {
    return {
      ok: true,
      dryRun: true,
      summary: update.summary,
      files: update.files.map((file) => file.path),
    };
  }
  const commit = await commitFilesToGitHub({
    fetchImpl,
    ...github,
    message: text(body?.commitMessage) || `content(api): upsert Hermes ${update.summary.kind}`,
    files: update.files,
  });
  return {
    ok: true,
    summary: update.summary,
    commit,
  };
}
