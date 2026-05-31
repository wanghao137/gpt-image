import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
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
const adminPretty = {
  name: "admin-pretty-url",
  apply: "build" as const,
  closeBundle() {
    const dist = resolve(__dirname, "dist");
    const adminHtml = resolve(dist, "admin.html");
    if (!existsSync(adminHtml)) return;
    const dir = resolve(dist, "admin");
    mkdirSync(dir, { recursive: true });
    copyFileSync(adminHtml, resolve(dir, "index.html"));
  },
};

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), adminPretty],
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 1200,
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
            manualChunks: {
              react: ["react", "react-dom", "react-router-dom"],
            },
          },
    },
  },
  esbuild: {
    legalComments: "none",
  },
  ssgOptions: {
    script: "async",
    formatting: "minify",
    crittersOptions: false,
    dirStyle: "nested",
    // SSG writer concurrency. On Windows + ~470 nested case/category dirs the
    // default of 20 hits an ENOENT race in vite-react-ssg's writer (a sibling
    // page's mkdir hasn't finished when the current one opens its index.html).
    // Linux/CI doesn't exhibit this, so we only throttle on win32 and let CI
    // run at full speed. Override with SSG_CONCURRENCY when debugging.
    concurrency: Number(process.env.SSG_CONCURRENCY) || (process.platform === "win32" ? 6 : 20),
  } as Record<string, unknown>,
}));
