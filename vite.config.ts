import { defineConfig } from "vite";
import "dotenv/config";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHmac, createHash } from "node:crypto";
import { resolve } from "node:path";

/**
 * After Vite emits `dist/admin.html`, also write `dist/admin/index.html` so
 * the admin works at the clean URL `/admin` on Vercel (which honours
 * `cleanUrls` for top-level paths but not for sub-routes that don't have a
 * matching directory index file).
 *
 * Sitemap generation lives in `scripts/build-sitemap.mjs` (run as `postbuild`)
 * because the SSG step hasn't run by the time this Vite plugin closes.
 */
const staticEntryCopies = {
  name: "static-entry-copies",
  apply: "build" as const,
  closeBundle() {
    const dist = resolve(__dirname, "dist");
    const indexHtml = resolve(dist, "index.html");
    if (existsSync(indexHtml)) {
      // Keep the client build's empty root before SSG replaces index.html with
      // homepage markup. Non-prerendered /case/* requests need a true SPA shell
      // or React will try to hydrate a case route against the homepage DOM.
      const spaDir = resolve(dist, "spa");
      mkdirSync(spaDir, { recursive: true });
      const spaHtml = readFileSync(indexHtml, "utf8").replace(
        /<div id="root">\s*<!--app-html-->\s*<\/div>/,
        '<div id="root"></div>',
      );
      writeFileSync(resolve(spaDir, "index.html"), spaHtml);
    }

    const adminHtml = resolve(dist, "admin.html");
    if (!existsSync(adminHtml)) return;
    const dir = resolve(dist, "admin");
    mkdirSync(dir, { recursive: true });
    copyFileSync(adminHtml, resolve(dir, "index.html"));
  },
};

// Local dev: store-backed case images live in the PRIVATE B2 bucket behind
// the /api/img-case function on production. B2 friendly URLs need a ≤24h
// download token, so a plain proxy with a static Authorization header 401s —
// instead this dev middleware SigV4-presigns each GET against the S3
// endpoint, same algorithm as api/img-case.js.
const B2_REGION = "us-east-005";
const B2_HOST = `s3.${B2_REGION}.backblazeb2.com`;
const B2_BUCKET = "taostudio-img";
const hmacSha = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();
function presignB2Get(key: string, expires = 300): string | null {
  const keyId = process.env.B2_STORE_KEY_ID;
  const appKey = process.env.B2_STORE_APP_KEY;
  if (!keyId || !appKey) return null;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const scope = `${amzDate.slice(0, 8)}/${B2_REGION}/s3/aws4_request`;
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${keyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });
  const canonical = ["GET", `/${B2_BUCKET}/${key}`, params.toString(), `host:${B2_HOST}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const signing = hmacSha(hmacSha(hmacSha(hmacSha(`AWS4${appKey}`, amzDate.slice(0, 8)), B2_REGION), "s3"), "aws4_request");
  params.set("X-Amz-Signature", createHmac("sha256", signing).update(toSign).digest("hex"));
  return `https://${B2_HOST}/${B2_BUCKET}/${key}?${params.toString()}`;
}
const devStoreImages = {
  name: "dev-store-images",
  configureServer(server: { middlewares: { use: (p: string, h: (req: { url?: string }, res: { statusCode?: number; setHeader?: (k: string, v: string) => void; end: (b?: Buffer | string) => void }, n: () => void) => void) => void } }) {
    server.middlewares.use("/images/cases", (req, res, next) => {
      const key = String(req.url || "").replace(/^\//, "").split("?")[0];
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(key)) {
        res.statusCode = 400;
        res.end("bad key");
        return;
      }
      const url = presignB2Get(`cases/${key}`);
      if (!url) {
        res.statusCode = 503;
        res.end("B2_STORE_* missing from .env.local — store images unavailable in dev");
        return;
      }
      fetch(url, { signal: AbortSignal.timeout(15000) })
        .then((up) => {
          res.statusCode = up.status;
          const ct = up.headers.get("content-type");
          if (ct && res.setHeader) res.setHeader("Content-Type", ct);
          return up.arrayBuffer();
        })
        .then((buf) => res.end(Buffer.from(buf)))
        .catch(() => {
          res.statusCode = 504;
          res.end();
        });
    });
  },
};

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), staticEntryCopies, devStoreImages],
  build: {
    // SSR build needs top-level await (used in data.ts for conditional data
    // loading). Client build stays at es2020 for broader browser compat.
    target: isSsrBuild ? "esnext" : "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 900,
    // Vercel re-invokes the build command within a single deployment; wiping
    // dist/ on every pass races the previous pass's output streaming (deploy
    // crashed with ENOENT on a random public image). Fresh clones start
    // without dist/, so skipping the wipe on CI is safe; local builds keep it
    // to avoid stale artifacts accumulating.
    emptyOutDir: !process.env.VERCEL,
    rollupOptions: {
      input: isSsrBuild
        ? // SSR build is driven by vite-react-ssg's own entry, no overrides needed.
          undefined
        : {
            main: resolve(__dirname, "index.html"),
            admin: resolve(__dirname, "admin.html"),
          },
      output: isSsrBuild
        ? undefined
        : {
            // Client-only chunking: SSR build externalises react, so manualChunks
            // there would explode. Splitting react vendor saves ~200KB on the
            // home page on first load.
            manualChunks(id) {
              // React vendor chunk — shared across all pages.
              if (id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) {
                return "react";
              }
              if (id.includes("node_modules/react/")) {
                return "react";
              }
              // NOTE: cases.json is no longer in the client bundle — it's
              // loaded via data-ssg.ts (SSR-only) and shards (client fetch).
            },
          },
    },
  },
  esbuild: {
    legalComments: "none",
  },
  ssgOptions: {
    // Hydration must wait until the full SSG DOM (including per-case embedded
    // data) has been parsed. An async module can execute while the root markup
    // is still streaming and cause React to hydrate against incomplete HTML.
    script: "defer",
    formatting: "minify",
    crittersOptions: false,
    dirStyle: "nested",
    // SSG writer concurrency. On Windows + ~470 nested case/category dirs the
    // default of 20 hits an ENOENT race in vite-react-ssg's writer (a sibling
    // page's mkdir hasn't finished when the current one opens its index.html).
    // Linux/CI doesn't exhibit this, so we only throttle on win32 and let CI
    // run at full speed. Override with SSG_CONCURRENCY when debugging.
    concurrency: Number(process.env.SSG_CONCURRENCY) || (process.platform === "win32" ? 6 : 20),
    // With 12K+ cases, pre-rendering every case detail page takes 15+ minutes
    // and risks Vercel build timeout. We cap case SSG to the most recent
    // SSG_CASE_LIMIT cases (by createdAt desc) — the rest fall back to
    // client-side rendering via the SPA wildcard route. Category, template,
    // and structural pages are always pre-rendered.
    includedRoutes: (paths) => {
      const limit = Number(process.env.SSG_CASE_LIMIT) || 800;
      const casePaths = paths.filter((p) => p.startsWith("/case/"));
      const nonCasePaths = paths.filter((p) => !p.startsWith("/case/"));
      // Sort case paths is not meaningful (they're slugs, not dates), but the
      // getStaticPaths in routes.tsx already returns them in cases.json order
      // (newest first via sortCasesForDisplay), so slicing preserves recency.
      const kept = casePaths.slice(0, limit);
      const result = [...nonCasePaths, ...kept];
      console.log(
        `[ssg] Pre-rendering ${kept.length}/${casePaths.length} case pages ` +
        `(limit ${limit}) + ${nonCasePaths.length} structural pages = ${result.length} total`,
      );
      return result;
    },
  } as Record<string, unknown>,
}));
