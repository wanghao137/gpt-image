import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  coerceStaticLoaderManifestResponse,
  installStaticLoaderManifestGuard,
  isStaticLoaderManifestUrl,
} from "./static-loader-manifest-core.mjs";

const mainSource = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
const routesSource = readFileSync(new URL("../routes.tsx", import.meta.url), "utf8");
const vercelConfig = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));

test("detects only vite-react-ssg static loader manifests", () => {
  assert.equal(isStaticLoaderManifestUrl("/static-loader-data-manifest-abcd1234.json"), true);
  assert.equal(isStaticLoaderManifestUrl("https://taostudioai.com/static-loader-data-manifest-old.json"), true);
  assert.equal(isStaticLoaderManifestUrl("/assets/static-loader-data-manifest-old.json"), false);
  assert.equal(isStaticLoaderManifestUrl("/data/prompts/static-loader-data-manifest-old.json"), false);
  assert.equal(isStaticLoaderManifestUrl("/data/cases.json"), false);
});

test("converts stale HTML manifest responses into an empty JSON manifest", async () => {
  const htmlResponse = new Response("<!DOCTYPE html><title>404</title>", {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

  const guarded = await coerceStaticLoaderManifestResponse(
    htmlResponse,
    "/static-loader-data-manifest-deleted.json",
  );

  assert.equal(guarded.status, 200);
  assert.match(guarded.headers.get("content-type") ?? "", /json/i);
  assert.equal(guarded.headers.get("x-taostudio-static-loader-fallback"), "1");
  assert.deepEqual(JSON.parse(await guarded.text()), {});
});

test("keeps valid JSON manifest responses unchanged", async () => {
  const manifest = { "/": { "0": null } };
  const jsonResponse = new Response(JSON.stringify(manifest), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

  const guarded = await coerceStaticLoaderManifestResponse(
    jsonResponse,
    "/static-loader-data-manifest-current.json",
  );

  assert.equal(guarded.status, 200);
  assert.deepEqual(JSON.parse(await guarded.text()), manifest);
});

test("fetch guard prevents manifest HTML from escaping to vite-react-ssg json parsing", async () => {
  const calls = [];
  const win = {
    fetch: async (input) => {
      calls.push(String(input));
      return new Response("<!DOCTYPE html><body>Vercel fallback</body>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    },
  };

  installStaticLoaderManifestGuard(win);
  const response = await win.fetch("/static-loader-data-manifest-stalehash.json");

  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(await response.text()), {});
  assert.equal(response.headers.get("x-taostudio-static-loader-fallback"), "1");
});

test("client entry installs the manifest guard before vite-react-ssg is initialized", () => {
  const installIndex = mainSource.indexOf("installStaticLoaderManifestGuard(");
  const rootIndex = mainSource.indexOf("ViteReactSSG(");

  assert.ok(installIndex >= 0, "main.tsx must install the static loader manifest guard");
  assert.ok(rootIndex >= 0, "main.tsx must initialize ViteReactSSG");
  assert.ok(installIndex < rootIndex, "manifest guard must run before ViteReactSSG creates loaders");
});

test("production keeps static loader manifests out of long-lived browser caches", () => {
  const manifestHeader = vercelConfig.headers.find(
    (entry) => entry.source === "/static-loader-data-manifest-(.*).json",
  );
  assert.ok(manifestHeader, "static loader manifest header route is missing");
  const cacheControl = manifestHeader.headers.find(
    (entry) => entry.key.toLowerCase() === "cache-control",
  )?.value;

  assert.equal(cacheControl, "no-store");
});

test("root route has an app error boundary instead of React Router's default crash screen", () => {
  assert.match(routesSource, /AppErrorBoundary/);
  assert.match(routesSource, /ErrorBoundary:\s*AppErrorBoundary/);
});
