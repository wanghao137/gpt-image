import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * After Vite emits `dist/admin.html`, also write `dist/admin/index.html` so
 * the admin works at the clean URL `/admin` on GitHub Pages (Pages serves
 * `<path>/index.html` for extensionless requests).
 */
const adminPretty = {
  name: "admin-pretty-url",
  apply: "build" as const,
  closeBundle() {
    const dist = resolve(__dirname, "dist");
    const dir = resolve(dist, "admin");
    mkdirSync(dir, { recursive: true });
    copyFileSync(resolve(dist, "admin.html"), resolve(dir, "index.html"));
  },
};

export default defineConfig({
  plugins: [react(), adminPretty],
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      // Two entry points: the public gallery + a hidden admin panel at /admin.
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
      },
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
  esbuild: {
    legalComments: "none",
  },
});
