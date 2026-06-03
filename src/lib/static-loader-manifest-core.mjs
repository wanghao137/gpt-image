const GUARD_FLAG = "__TAOSTUDIO_STATIC_LOADER_MANIFEST_GUARD__";
const MANIFEST_PATH_RE = /^\/static-loader-data-manifest-[^/?#]+\.json$/i;

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input && typeof input.url === "string") return input.url;
  return String(input ?? "");
}

export function isStaticLoaderManifestUrl(input) {
  const rawUrl = requestUrl(input);
  try {
    const url = new URL(rawUrl, "https://taostudioai.com");
    return MANIFEST_PATH_RE.test(url.pathname);
  } catch {
    return MANIFEST_PATH_RE.test(rawUrl);
  }
}

function fallbackResponse() {
  return new Response("{}", {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-taostudio-static-loader-fallback": "1",
    },
  });
}

function isJsonContentType(response) {
  return /\bjson\b/i.test(response.headers?.get?.("content-type") ?? "");
}

async function hasValidJsonBody(response) {
  try {
    JSON.parse(await response.clone().text());
    return true;
  } catch {
    return false;
  }
}

export async function coerceStaticLoaderManifestResponse(response, input) {
  if (!isStaticLoaderManifestUrl(input)) return response;
  if (!response || !response.ok) return fallbackResponse();
  if (isJsonContentType(response)) return response;
  if ((response.headers?.get?.("content-type") ?? "") === "" && (await hasValidJsonBody(response))) {
    return response;
  }
  return fallbackResponse();
}

export function installStaticLoaderManifestGuard(win = globalThis.window) {
  if (!win || win[GUARD_FLAG]) return false;
  if (typeof win.fetch !== "function") return false;

  const originalFetch = win.fetch.bind(win);
  win.fetch = async (input, init) => {
    const shouldGuard = isStaticLoaderManifestUrl(input);
    try {
      const response = await originalFetch(input, init);
      return coerceStaticLoaderManifestResponse(response, input);
    } catch (error) {
      if (shouldGuard) return fallbackResponse();
      throw error;
    }
  };

  Object.defineProperty(win, GUARD_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  return true;
}
