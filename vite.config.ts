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
    // Windows + lots of nested case/category dirs (~470 routes) hits an
    // ENOENT race in vite-react-ssg's writer at the default concurrency
    // of 20: a sibling page's mkdir hasn't finished by the time the
    // current one tries to open its index.html for writing. Capping at 6
    // is conservative but eliminates the race; CI on Linux is unaffected
    // and would happily run higher.
    concurrency: 6,
  } as Record<string, unknown>,
}));
