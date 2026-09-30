#!/usr/bin/env node
/**
 * Sentinel-guarded orchestrator for the Vercel build command.
 *
 * WHY THIS EXISTS (2026-09-30 incident): within a single deployment Vercel
 * re-invokes the build command (the events log shows two "Running
 * \"npm run vercel-build\"" banners for one deployment). The second
 * invocation runs in the SAME container against the SAME dist/ — and
 * vite.config sets `emptyOutDir: !process.env.VERCEL`, so the second pass's
 * client build overwrites the good prerendered dist/index.html with the
 * ~6KB client shell, then the pass is cut short before prerendering runs
 * again. The deployment still goes READY (pass 1 exited 0) and ships a
 * shell homepage while every other page stays fully prerendered.
 *
 * FIX: once a pass has produced a VERIFIED-complete dist/ (full chain +
 * gate + postbuild), write dist/.build-pass-complete. Any later invocation
 * in the same deployment sees the sentinel, re-runs the gate against the
 * existing artifacts, and exits 0 immediately — the good output is never
 * clobbered. A missing/failing sentinel means a full rebuild as before.
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");
const SENTINEL = resolve(DIST, ".build-pass-complete");

/** Files that only exist after a FULL pass (build + gate + postbuild). */
const CANARIES = ["index.html", "spa/index.html", "sitemap.xml", "404.html"];

function previousPassVerified() {
  try {
    if (!existsSync(SENTINEL)) return false;
    for (const f of CANARIES) {
      if (!statSync(resolve(DIST, f)).isFile()) return false;
    }
    // The SSG gate must pass against the artifacts on disk right now.
    const gate = spawnSync(process.execPath, ["scripts/check-ssg-output.mjs"], {
      cwd: ROOT,
      stdio: "pipe",
      encoding: "utf8",
    });
    if (gate.status !== 0) {
      console.error(
        "[vercel-build] sentinel present but gate failed on existing dist/ — rebuilding.\n" +
          (gate.stderr || "").trim(),
      );
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

if (previousPassVerified()) {
  console.log(
    "[vercel-build] previous pass output verified (sentinel + gate OK) — skipping rebuild",
  );
  process.exit(0);
}

// A stale/partial sentinel must not outlive this pass.
try {
  unlinkSync(SENTINEL);
} catch {
  /* absent — fine */
}

// Run the chain through npm so node_modules/.bin is on PATH exactly as
// before (tsc / vite-react-ssg are not globally installed).
const child = spawnSync("npm", ["run", "vercel-build:chain"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
});
if (child.status !== 0) {
  process.exit(child.status ?? 1);
}

writeFileSync(SENTINEL, `${new Date().toISOString()}\n`);
console.log("[vercel-build] pass complete — sentinel written");
