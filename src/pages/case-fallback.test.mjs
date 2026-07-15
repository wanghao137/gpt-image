import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viteConfig = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
const vercelConfig = JSON.parse(
  readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"),
);

test("client build preserves an empty SPA shell for non-prerendered case routes", () => {
  assert.match(viteConfig, /const spaDir = resolve\(dist, "spa"\)/);
  assert.match(viteConfig, /copyFileSync\(indexHtml, resolve\(spaDir, "index\.html"\)\)/);
});

test("SSG hydration waits for embedded case data to be parsed", () => {
  assert.match(viteConfig, /script:\s*"defer"/);
});

test("Vercel case fallback uses the empty SPA shell instead of homepage HTML", () => {
  const caseRewrite = vercelConfig.rewrites.find((item) => item.source === "/case/:slug*");
  assert.equal(caseRewrite?.destination, "/spa");
});
