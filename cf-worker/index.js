/**
 * taostudioai.com on Cloudflare Workers + R2.
 *
 * WHAT SERVES WHAT (2026-11-25 restructure)
 *   taostudioai.com  = 桃子AI画廊 (the static gallery that used to live at
 *                      cases.taostudioai.com) + /lab (the 4K lab, regenerated
 *                      with the gallery shell from lab-data/).
 *   cases.taostudioai.com / www.taostudioai.com -> 301 to the apex.
 *   The old React app (18,401 /case pages, /category, /templates, /admin and
 *   the B2-backed /images/cases/*) is retired: those paths answer 410 Gone.
 *   Its data is NOT deleted — the R2 buckets/objects and the B2 bucket are
 *   untouched, so the change is reversible.
 *
 * WHY WORKER (not Pages): the gallery build emits ~25k files (12.5k work
 * pages + 1.8k lab pages + data shards); Cloudflare Pages caps a deployment at
 * 20,000 files. R2 has no file-count limit; this Worker is the router.
 *
 * R2 layout (bucket taostudio-gallery, produced by tools/sync_site_v2_r2.mjs):
 *   index.html, p/<id>/index.html, c/<cat>/index.html, lab/, lab/<slug>/,
 *   data/<build_id>/*, data/lab/<build_id>/*, brand/, favicon*, sitemap.xml
 *   lab-images/** lives in the ASSETS bucket (taostudio-cases-assets) so the
 *   edge can serve the 480/1600 rungs without a Worker hop when requested via
 *   https://assets-cases.taostudioai.com/lab-images/...
 *
 * APIs: /api/translate (BigModel glm-4-flash, key in TRANSLATE_API_KEY),
 * plus the legacy /api/analytics/* and /api/hermes/content handlers kept for
 * the agent pipeline.
 */
import {
  authorizeAnalyticsSummaryRequest,
  handleAnalyticsSummary,
  handleCollectPageView,
} from "../src/server/site-analytics-core.mjs";
import {
  getHermesApiKey,
  handleHermesContentRequest,
  HermesContentError,
  isAuthorizedHermesRequest,
} from "../src/server/hermes-content-core.mjs";

const APEX = "taostudioai.com";
const REDIRECT_HOSTS = new Set(["cases.taostudioai.com", "www.taostudioai.com"]);

const HTML_CACHE = "public, max-age=300, stale-while-revalidate=86400";
const IMMUTABLE = "public, max-age=31536000, immutable";
const NO_STORE = "no-store";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/** Mirrors the gallery's old vercel.json `headers` block. */
function cacheControlFor(path) {
  if (path === "/sw.js") return "public, max-age=0, must-revalidate";
  if (path === "/offline.html") return "public, max-age=300, stale-while-revalidate=86400";
  if (path.startsWith("/data/")) return IMMUTABLE;
  if (path.startsWith("/images/") || path.startsWith("/lab-images/") || path.startsWith("/uploads/")) return IMMUTABLE;
  if (path === "/sitemap.xml" || path === "/robots.txt") return "public, max-age=600, s-maxage=3600";
  return HTML_CACHE;
}

function withHeaders(path, extra = {}) {
  const headers = new Headers(SECURITY_HEADERS);
  headers.set("Cache-Control", cacheControlFor(path));
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return headers;
}

/** R2 object -> Response, honouring HEAD and If-None-Match. */
function objectToResponse(object, path, request, status = 200) {
  const headers = withHeaders(path, {
    ETag: object.httpEtag,
    "Last-Modified": object.uploaded.toUTCString(),
  });
  const ct = object.httpMetadata?.contentType;
  if (ct) headers.set("Content-Type", ct);
  if (object.httpMetadata?.cacheControl) headers.set("Cache-Control", object.httpMetadata.cacheControl);

  const inm = request.headers.get("if-none-match");
  if (inm && INM_MATCH(inm, object.httpEtag)) {
    return new Response(null, { status: 304, headers });
  }
  if (request.method === "HEAD") return new Response(null, { status, headers });
  return new Response(object.body, { status, headers });
}

function INM_MATCH(header, etag) {
  const clean = etag.replace(/^W\//, "");
  return header.split(",").some((part) => {
    const v = part.trim().replace(/^W\//, "");
    return v === "*" || v === clean;
  });
}

async function tryKeys(bucket, keys) {
  for (const key of keys) {
    const obj = await bucket.get(key);
    if (obj) return { obj, key };
  }
  return null;
}

async function serveStatic(request, env, url) {
  const path = url.pathname;

  // lab 的 480/1600 图层在 assets 桶（同 key 路径），与图库图片共用一个桶。
  if (path.startsWith("/lab-images/") || path.startsWith("/uploads/")) {
    const hit = await tryKeys(env.ASSETS, [path.slice(1)]);
    if (hit) return objectToResponse(hit.obj, path, request);
    return notFound(env, path, request);
  }

  // 4K 原图（taostudio-lab 桶，1,770 个 lab/.../*.webp）。走同源是为了让
  // 《下载 4K 原图》按钮能用 <a download> / fetch+blob（跨域时会被浏览器忽略）。
  if (path.startsWith("/lab-orig/")) {
    const key = path.slice("/lab-orig/".length);
    if (!/^lab\/[A-Za-z0-9/_.-]+\.(webp|png|jpg|jpeg)$/.test(key) || key.includes("..")) {
      return new Response("bad key", { status: 400, headers: { "Cache-Control": NO_STORE } });
    }
    const obj = await env.LAB.get(key);
    if (!obj) return notFound(env, path, request);
    const headers = withHeaders(path, {
      ETag: obj.httpEtag,
      "Last-Modified": obj.uploaded.toUTCString(),
      "Content-Type": obj.httpMetadata?.contentType || "image/webp",
      "Cache-Control": IMMUTABLE,
      "Content-Disposition": `attachment; filename="${key.split("/").pop()}"`,
    });
    const inm = request.headers.get("if-none-match");
    if (inm && INM_MATCH(inm, obj.httpEtag)) return new Response(null, { status: 304, headers });
    if (request.method === "HEAD") return new Response(null, { status: 200, headers });
    return new Response(obj.body, { status: 200, headers });
  }

  const key = path.replace(/^\/+/, "");
  let keys;
  if (key === "") keys = ["index.html"];
  else if (key.endsWith("/")) keys = [`${key}index.html`];
  else keys = [key, `${key}/index.html`, `${key}.html`];

  const hit = await tryKeys(env.SITE, keys);
  if (hit) return objectToResponse(hit.obj, path, request);
  return notFound(env, path, request);
}

async function notFound(env, path, request) {
  const page = await env.SITE.get("404.html");
  const headers = withHeaders(path, {});
  headers.set("Cache-Control", NO_STORE);
  if (!page) return new Response("Not Found", { status: 404, headers });
  headers.set("Content-Type", "text/html; charset=utf-8");
  if (request.method === "HEAD") return new Response(null, { status: 404, headers });
  return new Response(page.body, { status: 404, headers });
}

/** 410 Gone:内容已永久移除（旧的案例库 / 模板 / 后台），比 404 更快去索引。 */
function gone(path) {
  const safe = path.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>内容已下线｜桃子AI画廊</title><meta name="robots" content="noindex,follow"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbfaf7;color:#211b16;font:15px/1.7 system-ui,-apple-system,"Noto Sans SC",sans-serif}main{max-width:34em;padding:32px 24px;text-align:center}a{color:#7a2d19}code{background:rgba(33,27,22,.06);padding:1px 5px;border-radius:5px;word-break:break-all}</style></head><body><main><h1 style="font-size:22px;margin:0 0 10px">这个页面已经下线</h1><p>旧站的内容已整体迁移：现在是 <b>桃子AI画廊</b>（作品）和 <b>4K 实验室</b>（原图+提示词）。</p><p><code>${safe}</code></p><p><a href="/">回画廊首页</a> · <a href="/lab/">去 4K 实验室</a></p></main></body></html>`;
  return new Response(body, {
    status: 410,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}

/* ------------------------------------------------------------------ */
/* /api/translate — on-demand prompt translation (was tools/vercel_api) */
/* ------------------------------------------------------------------ */
const SYSTEM_PROMPTS = {
  en2zh:
    "你是专业的 AI 绘画提示词翻译。把用户给出的英文提示词忠实翻译成简体中文。" +
    "要求：保留原有分段、换行和列表结构；规格参数（如 3:4、16:9、--ar）与人名等专有名词保留原文；" +
    "引号内要绘制进画面的文字一并翻译；不要解释、不要添加任何注释，只输出译文。",
  zh2en:
    "你是专业的 AI 绘画提示词翻译。把用户给出的中文提示词忠实翻译成英文。" +
    "要求：保留原有分段、换行和列表结构；规格参数（如 3:4、16:9、--ar）与人名等专有名词保留原文；" +
    "译文应是自然、可直接用于图像生成模型的英文提示词；不要解释、不要添加任何注释，只输出译文。",
};

function isMostlyCJK(text) {
  const sample = [...String(text || "")].filter((c) => !/\s/.test(c));
  if (!sample.length) return false;
  let cjk = 0;
  for (const c of sample) {
    const cp = c.codePointAt(0);
    if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf)) cjk++;
  }
  return cjk / sample.length > 0.3;
}

const json = (status, payload, extra = {}) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": NO_STORE, ...extra },
  });

async function apiTranslate(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
  if (request.method !== "POST") return json(405, { error: "method not allowed" }, { Allow: "POST, OPTIONS" });

  const origin = request.headers.get("origin") || "";
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = "";
    }
    const ok =
      originHost === new URL(request.url).host ||
      /(^|\.)taostudioai\.com$/.test(originHost) ||
      /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(originHost);
    if (!ok) return json(403, { error: "forbidden origin" });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "bad json" });
  }
  const text = body?.text;
  const id = body?.id;
  if (typeof text !== "string" || !text.trim() || text.length > 4096) return json(400, { error: "bad text" });
  if (typeof id !== "undefined" && (typeof id !== "string" || !/^[\w-]{1,120}$/.test(id))) {
    return json(400, { error: "bad id" });
  }
  const apiKey = env.TRANSLATE_API_KEY;
  if (!apiKey) return json(503, { error: "translation not configured" });

  const direction = /[\u3040-\u30ff]/.test(text) ? "en2zh" : isMostlyCJK(text) ? "zh2en" : "en2zh";
  const model = env.TRANSLATE_MODEL || "glm-4-flash";
  let translated = "";
  for (let attempt = 0; attempt < 2 && !translated; attempt++) {
    try {
      const resp = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: SYSTEM_PROMPTS[direction] },
            { role: "user", content: text },
          ],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        translated = (data.choices?.[0]?.message?.content || "").trim();
      } else if (resp.status === 429) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch {
      // retry once
    }
  }
  if (!translated) return json(502, { error: "translate failed" });
  return json(200, { t: translated, dir: direction, id: id || null, model });
}

/* ------------------------------------------------------------------ */
/* API adapters around the Vercel-style handlers (analytics / hermes)  */
/* ------------------------------------------------------------------ */

async function buildReq(request) {
  const headers = {};
  for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;
  // Vercel set x-real-ip; on Workers the trusted source is CF-Connecting-IP.
  if (!headers["x-real-ip"]) {
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) headers["x-real-ip"] = ip;
  }
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
  return {
    method: request.method,
    headers,
    body,
    query: Object.fromEntries(new URL(request.url).searchParams),
    url: request.url,
  };
}

function makeRes() {
  let status = 200;
  const headers = {};
  const state = { response: null };
  state.res = {
    get statusCode() {
      return status;
    },
    set statusCode(v) {
      status = v;
    },
    setHeader(k, v) {
      headers[k] = v;
    },
    end(payload) {
      state.response = new Response(payload == null ? null : payload, { status, headers });
    },
  };
  return state;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", NO_STORE);
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(JSON.stringify(payload));
}

async function apiCollect(request, env) {
  const req = await buildReq(request);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } }), {
      status: 405,
      headers: { Allow: "POST, OPTIONS", "Content-Type": "application/json" },
    });
  }
  let body = {};
  try {
    if (typeof req.body === "string" && req.body.trim()) body = JSON.parse(req.body);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: { code: "BAD_JSON" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const result = await handleCollectPageView({ body, headers: req.headers, env, fetchImpl: fetch });
    return new Response(JSON.stringify(result), {
      status: 202,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": NO_STORE },
    });
  } catch {
    // Collect must never break a page view: swallow and answer 202.
    return new Response(JSON.stringify({ ok: false, error: { code: "COLLECT_FAILED" } }), {
      status: 202,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": NO_STORE },
    });
  }
}

async function apiSummary(request, env) {
  const req = await buildReq(request);
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": NO_STORE,
    "X-Robots-Tag": "noindex, nofollow",
  });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: new Headers({ Allow: "GET, OPTIONS" }) });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } }), { status: 405, headers });
  }
  try {
    const auth = authorizeAnalyticsSummaryRequest({ headers: req.headers, env });
    if (auth && auth.ok === false) {
      headers.set("WWW-Authenticate", 'Bearer realm="analytics"');
      return new Response(JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED" } }), { status: 401, headers });
    }
    const days = Number(req.query?.days || 30);
    const result = await handleAnalyticsSummary({ days, env, fetchImpl: fetch });
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "SUMMARY_FAILED", message: String(error?.message || error) } }),
      { status: 500, headers },
    );
  }
}

async function apiHermes(request, env) {
  const req = await buildReq(request);
  const state = makeRes();
  const { res } = state;
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } });
    return state.response;
  }
  try {
    const expectedKey = getHermesApiKey(env);
    if (!isAuthorizedHermesRequest(req, expectedKey)) {
      sendJson(res, 401, { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid Hermes API key" } });
      return state.response;
    }
    let body = {};
    try {
      body = typeof req.body === "string" && req.body.trim() ? JSON.parse(req.body) : {};
    } catch {
      sendJson(res, 400, { ok: false, error: { code: "BAD_JSON", message: "Request body must be valid JSON" } });
      return state.response;
    }
    const result = await handleHermesContentRequest({ body, env, fetchImpl: fetch });
    sendJson(res, 200, result);
    return state.response;
  } catch (error) {
    const status = error instanceof HermesContentError ? error.status : 500;
    sendJson(res, status, {
      ok: false,
      error: {
        code: error instanceof HermesContentError ? error.code : "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return state.response;
  }
}

/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;
    const path = url.pathname;

    // One canonical origin: cases./www. -> apex (path + query preserved).
    if (REDIRECT_HOSTS.has(host)) {
      return new Response(null, {
        status: 301,
        headers: { Location: `https://${APEX}${path}${url.search}`, "Cache-Control": "public, max-age=3600" },
      });
    }

    if (path === "/api/translate") return apiTranslate(request, env);
    if (path === "/api/analytics/collect") return apiCollect(request, env);
    if (path === "/api/analytics/summary") return apiSummary(request, env);
    if (path === "/api/hermes/content") return apiHermes(request, env);
    if (path.startsWith("/api/")) return json(404, { ok: false, error: { code: "NOT_FOUND" } });

    // Retired surface of the old React app: keep the URLs honest (410), only
    // /cases (a listing) is worth redirecting to the new home.
    if (path === "/cases" || path === "/cases/") {
      return new Response(null, { status: 301, headers: { Location: "/", "Cache-Control": "public, max-age=3600" } });
    }
    if (
      path.startsWith("/case/") ||
      path === "/case" ||
      path.startsWith("/category/") ||
      path.startsWith("/templates") ||
      path.startsWith("/template/") ||
      path.startsWith("/admin") ||
      path.startsWith("/images/cases/") ||
      path === "/about" ||
      path === "/sitemap-page"
    ) {
      if (request.method === "HEAD") return new Response(null, { status: 410, headers: { "X-Robots-Tag": "noindex, follow" } });
      return gone(path);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    return serveStatic(request, env, url);
  },
};
