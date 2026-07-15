import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viteConfig = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
const mainEntry = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
const vercelConfig = JSON.parse(
  readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"),
);

test("client build preserves an empty SPA shell for non-prerendered case routes", () => {
  assert.match(viteConfig, /const spaDir = resolve\(dist, "spa"\)/);
  assert.match(viteConfig, /<!--app-html-->/);
  assert.match(viteConfig, /'<div id="root"><\/div>'/);
  assert.match(viteConfig, /writeFileSync\(resolve\(spaDir, "index\.html"\), spaHtml\)/);
});

test("client-only case shells render instead of hydrating empty markup", () => {
  assert.match(mainEntry, /const isClientOnlyShell =/);
  assert.match(mainEntry, /document\.querySelector\("\[data-server-rendered=true\]"\) === null/);
  assert.match(mainEntry, /createClientRoot\(container\)\.render/);
  assert.match(mainEntry, /isClientOnlyShell\s*\? mountClientOnlyApp\(\)\s*:\s*ViteReactSSG/);
});

test("SSG hydration waits for embedded case data to be parsed", () => {
  assert.match(viteConfig, /script:\s*"defer"/);
});

test("Vercel case fallback uses the empty SPA shell instead of homepage HTML", () => {
  const caseRewrite = vercelConfig.rewrites.find((item) => item.source === "/case/:slug*");
  assert.equal(caseRewrite?.destination, "/spa");
});
