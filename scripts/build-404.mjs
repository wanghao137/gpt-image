/**
 * Copy the SSG-rendered NotFound page (dist/404/index.html) to dist/404.html.
 *
 * WHY
 *   Vercel serves `404.html` (when present) with a real HTTP 404 status for
 *   any URL that doesn't match a static file or route. Previously, unknown
 *   URLs fell through to the SPA `*` route and rendered the NotFound component
 *   under an HTTP 200 — a "soft 404" that search engines penalise (they see a
 *   200 and may index the empty page, or distrust the site's status codes).
 *
 *   The `/404` route is pre-rendered by vite-react-ssg (see routes.tsx), so
 *   we just promote its index.html to the conventional dist/404.html name.
 */
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve(process.cwd(), "dist");
const rendered = resolve(dist, "404", "index.html");
const target = resolve(dist, "404.html");

if (!existsSync(dist)) {
  console.log("build-404: no dist/ yet, skipping");
  process.exit(0);
}
if (!existsSync(rendered)) {
  console.warn("build-404: dist/404/index.html not found — did SSG render the /404 route?");
  process.exit(0);
}

copyFileSync(rendered, target);
console.log("build-404: wrote dist/404.html (branded 404 with real status code)");
