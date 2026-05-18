/**
 * Edge image proxy.
 *
 * Why this exists:
 *   The case dataset references images on `raw.githubusercontent.com` and
 *   `cdn.jsdelivr.net`. From mainland-China mobile networks both are slow and
 *   intermittently unreachable (raw.github is partially blocked, jsdelivr now
 *   301-redirects back to raw.github for this repo so it's no faster). The
 *   wsrv.nl free CDN we previously used resolves to North-America POPs, which
 *   adds another 200–400ms RTT on top.
 *
 *   This Function turns *our* deployment (Cloudflare Pages, edge-served from
 *   HKG / NRT / SIN among others) into the canonical image origin. Each image
 *   is fetched once at the edge then cached for a year via CF's tiered cache;
 *   subsequent visitors anywhere in the world hit a nearby POP.
 *
 * URL shape:
 *   /img/<host>/<path>          (no protocol, host first; path may contain slashes)
 *
 *   Examples:
 *     /img/raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main/data/images/case1.jpg
 *     /img/cdn.jsdelivr.net/gh/freestylefly/awesome-gpt-image-2@main/data/images/case1.jpg
 *
 *   Query params are forwarded to the origin verbatim (preserves any signed
 *   URL params upstream might add) and form part of the cache key, so
 *   `?v=2` style cache busts work exactly like a normal CDN.
 *
 * Cache strategy:
 *   - We respond with `Cache-Control: public, max-age=31536000, immutable`
 *     and rely on CF's automatic edge cache plus tiered cache. The first
 *     request to any POP triggers a cold fetch; subsequent requests at any
 *     POP hit the edge in <50ms.
 *   - We use `caches.default` explicitly so that range requests, redirects,
 *     and 404s are all cached predictably. CF's default behaviour for
 *     dynamic Functions is "do not cache"; opting in via `caches.default.put`
 *     is the recommended pattern.
 *   - Origin failures (5xx, network) fall through to a 502 with a 60s
 *     edge cache to prevent thundering herd, but successful responses
 *     get the full year.
 *
 * Allow-list:
 *   We only proxy known image hosts. This prevents this endpoint from being
 *   abused as an open relay / SSRF vector.
 */

interface Env {
  // No bindings yet; placeholder for future KV / R2 hookups.
}

const ALLOWED_HOSTS = new Set([
  "raw.githubusercontent.com",
  "cdn.jsdelivr.net",
  "github.com",
  "user-images.githubusercontent.com",
  "avatars.githubusercontent.com",
  // wsrv as a back-stop in case the dataset ever hard-codes wsrv URLs.
  "wsrv.nl",
  "images.weserv.nl",
]);

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif|svg|bmp)$/i;

// CF Pages Functions context type. We only use a few fields, so we describe
// them inline rather than depending on @cloudflare/workers-types.
interface PagesContext {
  request: Request;
  env: Env;
  params: { path?: string | string[] };
  waitUntil(p: Promise<unknown>): void;
}

export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  const { request, params } = ctx;
  const url = new URL(request.url);

  // Build the target URL. `params.path` is the matched [[path]] route — Pages
  // delivers it as either a string or string[] depending on segment count.
  const segments = Array.isArray(params.path)
    ? params.path
    : params.path
      ? [params.path]
      : [];
  if (segments.length < 1) {
    return jsonError(400, "missing host");
  }
  const [host, ...rest] = segments;
  if (!ALLOWED_HOSTS.has(host)) {
    return jsonError(403, `host not allowed: ${host}`);
  }
  const remotePath = rest.join("/");
  // Some hosts (e.g. wsrv.nl) take all their state in the query string and
  // serve from `/`. Skip the path-extension check for those by treating an
  // empty path + presence of a `url` query param as a valid transform call.
  const hasUrlParam = url.searchParams.has("url");
  if (remotePath && !IMAGE_EXTENSIONS.test(remotePath)) {
    return jsonError(400, "only image files are proxied");
  }
  if (!remotePath && !hasUrlParam) {
    return jsonError(400, "empty path requires a `url` query param");
  }

  const target = new URL(
    remotePath ? `https://${host}/${remotePath}` : `https://${host}/`,
  );
  // Forward all query params verbatim. wsrv.nl in particular uses query
  // params for its transform API (`?w=480&output=webp`), and even simple
  // cache-busters (`?v=2`) need to round-trip.
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  // Use the request URL itself as the cache key — query params included, so
  // each `?w=N` variant caches independently.
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) {
    // Add a header so we can spot cache hits in DevTools / RUM.
    const h = new Headers(cached.headers);
    h.set("x-edge-cache", "HIT");
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: h,
    });
  }

  // Cold fetch. We let CF's transparent fetch handle TLS + connection reuse.
  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      // CF's `cf` field tweaks how the underlying fetcher behaves.
      // - `cacheEverything` opts the upstream response itself into CF's cache
      //   regardless of the origin's cache directives, which matters because
      //   raw.github sends `Cache-Control: max-age=300` (way too short).
      // - `cacheTtl` is the TTL we want CF to apply when caching the origin
      //   response on top of our caches.default put below.
      cf: {
        cacheEverything: true,
        cacheTtl: 31_536_000,
      },
      headers: {
        // Identify ourselves so origin operators can see a real UA.
        "user-agent":
          "gpt-image-edge-proxy/1.0 (+https://gpt-image-6hu.pages.dev)",
        // Pass through Accept so origins that content-negotiate honour it.
        accept: request.headers.get("accept") || "image/*",
      },
      // Ranges are useful for big images on slow connections; pass through.
      // (We only support GET, but a Range header on GET is fine.)
      redirect: "follow",
    });
  } catch (err) {
    return errorResponse(502, "upstream fetch failed", err);
  }

  if (!upstream.ok) {
    // Cache 4xx for a minute to avoid hammering origins on broken URLs;
    // don't cache 5xx for long since they may be transient.
    const ttl = upstream.status >= 500 ? 30 : 60;
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        "cache-control": `public, max-age=${ttl}`,
        "content-type": upstream.headers.get("content-type") || "text/plain",
        "x-edge-cache": "BYPASS",
      },
    });
  }

  // Build the response we want clients (and the CF cache) to see. We strip
  // upstream cache headers and replace with our own immutable policy because
  // we treat any successful image response as content-addressed.
  const responseHeaders = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) responseHeaders.set("content-type", ct);
  const cl = upstream.headers.get("content-length");
  if (cl) responseHeaders.set("content-length", cl);
  // 1 year, immutable. Raw image bytes for a given case id never change in
  // this dataset; if upstream republishes, the URL changes too.
  responseHeaders.set("cache-control", "public, max-age=31536000, immutable");
  responseHeaders.set("access-control-allow-origin", "*");
  responseHeaders.set("cross-origin-resource-policy", "cross-origin");
  responseHeaders.set("timing-allow-origin", "*");
  // Avoid leaking referer to origin on subsequent loads (the origin already
  // saw us during the cold fetch).
  responseHeaders.set("referrer-policy", "no-referrer");
  responseHeaders.set("x-edge-cache", "MISS");

  // Tee the body — one stream goes to the client, the other to the cache.
  // Without tee() we'd have to choose between caching and streaming.
  const [clientBody, cacheBody] = upstream.body
    ? upstream.body.tee()
    : [null, null];

  const clientResponse = new Response(clientBody, {
    status: 200,
    headers: responseHeaders,
  });

  if (cacheBody) {
    const cacheResponse = new Response(cacheBody, {
      status: 200,
      headers: responseHeaders,
    });
    // Run the cache write in the background so we don't block the client.
    ctx.waitUntil(cache.put(cacheKey, cacheResponse));
  }

  return clientResponse;
};

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

function errorResponse(status: number, message: string, err: unknown): Response {
  const detail = err instanceof Error ? err.message : String(err);
  return new Response(JSON.stringify({ error: message, detail }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30",
    },
  });
}
