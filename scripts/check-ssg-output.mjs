/**
 * SSG output gate for vercel-build.
 *
 * The 2026-09-30 incident: production served the client-shell index.html
 * (6KB, no title) while the same commit built a full 219KB SSG homepage
 * locally. A shell that exits 0 goes LIVE and replaces the last good
 * deployment — every page becomes client-rendered and the site breaks.
 * This gate fails the build loudly instead, so Vercel keeps the previous
 * (good) deployment.
 *
 * A full SSG homepage has the data-rh marker from the prerenderer and is
 * far larger than the ~6KB client shell. Tune the floor generously low
 * (50KB) so legitimate data-size changes never trip it.
 */
import { readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = resolve(ROOT, "dist", "index.html");

const failures = [];
let size = 0;
try {
  size = statSync(INDEX).size;
} catch {
  failures.push("dist/index.html is missing entirely");
}

if (!failures.length) {
  const html = readFileSync(INDEX, "utf8");
  if (size < 50 * 1024) {
    failures.push(
      `dist/index.html is only ${(size / 1024).toFixed(0)}KB — this is the client shell, not the SSG homepage`,
    );
  }
  if (!html.includes("data-rh")) {
    failures.push('dist/index.html lacks the data-rh prerender marker — SSG did not run');
  }
  if (!/<div id="root">[^<]/.test(html)) {
    failures.push("dist/index.html has an empty #root — prerender produced no markup");
  }
}

if (failures.length) {
  console.error(`\n[check-ssg-output] FAILED — refusing to ship a shell homepage:`);
  for (const f of failures) console.error("  - " + f);
  console.error(
    "\nThe previous deployment is retained. Investigate the vite-react-ssg " +
      "prerender step above (memory/OOM is the usual suspect at ~18K records).",
  );
  process.exit(1);
}

console.log(`[check-ssg-output] OK — dist/index.html is ${(size / 1024).toFixed(0)}KB of prerendered homepage`);
