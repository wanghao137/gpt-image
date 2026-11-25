/**
 * taostudioai.com on Cloudflare Workers + R2.
 *
 * WHY WORKER (not Pages): the SSG build emits ~42k files (18,401 case pages +
 * 18,401 prompt JSONs + 7.4k images + data shards). Cloudflare Pages caps a
 * deployment at 20,000 files, so Pages cannot host this site at all. R2 has no
 * file-count limit; this Worker is the router in front of it.
 *
 * RESPONSIBILITIES
 *   1. Serve static objects from R2 (SITE bucket), with Vercel-equivalent
 *      clean-URL behaviour: /x -> x, x/index.html, x.html.
 *   2. /data/prompts/* lives in the ASSETS bucket (prompts/ prefix).
 *   3. /api/analytics/{collect,summary} and /api/hermes/content — the three
 *      Vercel functions, re-implemented as Workers handlers over the same
 *      core modules (src/server/*.mjs) so behaviour and security are identical.
 *   4. Cache-Control + security headers, mirroring the old vercel.json.
 *
 * Vercel handler shim note: the existing functions expect (req, res) with
 * req.body/req.query/req.headers. We build that shim rather than forking the
 * core logic, and pass `env` explicitly (Pages/Workers have no process.env
 * populated by default).
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

const HTML_CACHE = "public, max-age=0, must-revalidate";

/* ------------------------------------------------------------------ */
/* Case images: private B2 bucket behind a signing proxy               */
/* (faithful port of api/img-case.js — the bucket stays private)        */
/* ------------------------------------------------------------------ */
const B2_BUCKET = "taostudio-img";
const B2_REGION = "us-east-005";
const B2_HOST = `s3.${B2_REGION}.backblazeb2.com`;
const ALLOWED_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;
const TEXT = new TextEncoder();

async function sha256Hex(data) {
  const buf = await crypto.subtle.digest("SHA-256", typeof data === "string" ? TEXT.encode(data) : data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac256(key, data) {
  const keyBytes = typeof key === "string" ? TEXT.encode(key) : new Uint8Array(key);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, typeof data === "string" ? TEXT.encode(data) : data);
}

/** SigV4 query-presigned GET URL for one object (60s expiry). */
async function presignB2Get(objectKey, env, expires = 60) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${B2_REGION}/s3/aws4_request`;
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${env.B2_STORE_KEY_ID}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalRequest = [
    "GET",
    `/${B2_BUCKET}/${objectKey}`,
    params.toString(),
    `host:${B2_HOST}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");
  const kDate = await hmac256(`AWS4${env.B2_STORE_APP_KEY}`, dateStamp);
  const kRegion = await hmac256(kDate, B2_REGION);
  const kService = await hmac256(kRegion, "s3");
  const kSigning = await hmac256(kService, "aws4_request");
  const signature = [...new Uint8Array(await hmac256(kSigning, stringToSign))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  params.set("X-Amz-Signature", signature);
  return `https://${B2_HOST}/${B2_BUCKET}/${objectKey}?${params.toString()}`;
}

async function serveCaseImage(request, env, ctx) {
  const url = new URL(request.url);
  const key = url.pathname.slice("/images/cases/".length);
  if (!ALLOWED_KEY.test(key)) {
    return new Response("bad key", { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (!env.B2_STORE_KEY_ID || !env.B2_STORE_APP_KEY) {
    return new Response("store credentials not configured", { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  // Edge cache: B2 is the origin, each object should be fetched once per POP.
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return request.method === "HEAD" ? new Response(null, { status: 200, headers: cached.headers }) : cached;
  }

  const fetchObject = async (objectKey) =>
    fetch(await presignB2Get(objectKey, env), { cf: { cacheTtl: 0 } });

  let upstream = await fetchObject(`cases/${key}`);
  // Byte-identical duplicate 1280 rungs are trimmed from the bucket
  // (scripts/trim-duplicate-1280.mjs) — serve the 960 bytes instead.
  if (upstream.status === 404) {
    const m = key.match(/^(.+)-1280\.webp$/);
    if (m) upstream = await fetchObject(`cases/${m[1]}-960.webp`);
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: upstream.status === 404 ? 404 : 502, headers: { "Cache-Control": "no-store" } });
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
    "Cache-Control": "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=2592000",
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  const response = new Response(request.method === "HEAD" ? null : upstream.body, { status: 200, headers });
  if (request.method === "GET") ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/** Same table as the old vercel.json `headers` block. */
function cacheControlFor(path) {
  if (path.startsWith("/assets/") || path.startsWith("/fonts/")) {
    return "public, max-age=31536000, immutable";
  }
  if (path.startsWith("/images/") || path.startsWith("/uploads/") || path.startsWith("/lab-images/")) {
    return "public, max-age=86400, s-maxage=86400, stale-while-revalidate=2592000";
  }
  if (path.startsWith("/data/prompts/")) {
    return "public, max-age=86400";
  }
  if (/^\/data\/cases-[^/]*\.json$/.test(path) || path === "/data/filter-options.json") {
    return "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
  }
  if (path === "/sitemap.xml" || path === "/robots.txt" || path === "/favicon.svg") {
    return path === "/favicon.svg" ? "public, max-age=86400" : "public, max-age=600, s-maxage=3600";
  }
  if (path === "/admin" || path === "/admin.html" || path.startsWith("/admin/")) {
    return "no-store";
  }
  return HTML_CACHE;
}

function withHeaders(path, extra = {}) {
  const headers = new Headers(SECURITY_HEADERS);
  headers.set("Cache-Control", cacheControlFor(path));
  if (path === "/admin" || path === "/admin.html" || path.startsWith("/admin/")) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }
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

  // Prompt data lives in the assets bucket (kept out of the site bucket).
  if (path.startsWith("/data/prompts/")) {
    const rest = path.slice("/data/prompts/".length);
    const hit = await tryKeys(env.ASSETS, [`prompts/${rest}`]);
    if (hit) return objectToResponse(hit.obj, path, request);
    return notFound(env, path, request);
  }

  // lab-images/ and uploads/ were uploaded to the assets bucket (same key path),
  // so /images-cases traffic and these never share a bucket.
  if (path.startsWith("/lab-images/") || path.startsWith("/uploads/")) {
    const hit = await tryKeys(env.ASSETS, [path.slice(1), `${path.slice(1)}index.html`]);
    if (hit) return objectToResponse(hit.obj, path, request);
    return notFound(env, path, request);
  }

  const key = path.replace(/^\/+/, "");
  let keys;
  if (key === "") keys = ["index.html"];
  else if (key.endsWith("/")) keys = [`${key}index.html`];
  else keys = [key, `${key}/index.html`, `${key}.html`];

  const hit = await tryKeys(env.SITE, keys);
  if (hit) return objectToResponse(hit.obj, path, request);

  // SPArity: unknown case slugs fall back to the client shell, like the
  // old vercel.json rewrite /case/:slug* -> /spa.
  if (path.startsWith("/case/")) {
    const spa = await env.SITE.get("spa/index.html");
    if (spa) {
      const headers = withHeaders(path, { ETag: spa.httpEtag, Vary: "Accept-Encoding" });
      headers.set("Content-Type", "text/html; charset=utf-8");
      if (request.method === "HEAD") return new Response(null, { status: 200, headers });
      return new Response(spa.body, { status: 200, headers });
    }
  }
  return notFound(env, path, request);
}

async function notFound(env, path, request) {
  const page = await env.SITE.get("404.html");
  const headers = withHeaders(path, {});
  headers.set("Cache-Control", "no-store");
  if (!page) return new Response("Not Found", { status: 404, headers });
  headers.set("Content-Type", "text/html; charset=utf-8");
  if (request.method === "HEAD") return new Response(null, { status: 404, headers });
  return new Response(page.body, { status: 404, headers });
}

/* ------------------------------------------------------------------ */
/* API: adapters around the Vercel-style handlers                      */
/* ------------------------------------------------------------------ */

async function buildReq(request) {
  const headers = {};
  for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;
  // Vercel set x-real-ip; on Workers the trusted source is CF-Connecting-IP.
  if (!headers["x-real-ip"]) {
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) headers["x-real-ip"] = ip;
  }
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
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
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(JSON.stringify(payload));
}

async function apiCollect(request, env) {
  const req = await buildReq(request);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
  if (req.method !== "POST") {
    const headers = new Headers({ Allow: "POST, OPTIONS", "Content-Type": "application/json" });
    return new Response(JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } }), { status: 405, headers });
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
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Collect must never break a page view: swallow and answer 202.
    return new Response(JSON.stringify({ ok: false, error: { code: "COLLECT_FAILED" } }), {
      status: 202,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}

async function apiSummary(request, env) {
  const req = await buildReq(request);
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: new Headers({ Allow: "GET, OPTIONS" }) });
  if (req.method !== "GET") return new Response(JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } }), { status: 405, headers });
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
    const path = url.pathname;

    if (path === "/api/analytics/collect") return apiCollect(request, env);
    if (path === "/api/analytics/summary") return apiSummary(request, env);
    if (path === "/api/hermes/content") return apiHermes(request, env);
    if (path.startsWith("/api/")) {
      return new Response(JSON.stringify({ ok: false, error: { code: "NOT_FOUND" } }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    // Case images live in the private B2 bucket; everything else is in R2.
    if (path.startsWith("/images/cases/")) return serveCaseImage(request, env, ctx);

    return serveStatic(request, env, url);
  },
};
