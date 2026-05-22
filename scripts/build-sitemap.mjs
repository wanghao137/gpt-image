/**
 * Generate public/sitemap.xml for dev and dist/sitemap.xml after SSG build.
 *
 * Source of truth: `public/data/cases.json` + the in-code category list.
 * Run via npm script `postbuild`; it is also safe to run before `dist/`
 * exists, which keeps `/sitemap.xml` available in Vite dev.
 */
import { buildSitemap } from "./build-sitemap-core.mjs";

const result = buildSitemap();
const targets = result.written.map((item) => item.replace(process.cwd(), ".")).join(", ");

console.log(`wrote sitemap.xml: ${result.urls} URLs -> ${targets}`);
