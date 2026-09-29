import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

/**
 * Regression gate for the 2026-09-29 CN image outage. Once the image store
 * manifest exists (i.e. the store-backed pipeline has shipped), no published
 * record may point at an external image host again — every image must be
 * same-origin (/images/* disk assets or /images/cases/* store assets or
 * /uploads/*). A future change that reintroduces hot-linked CDN URLs fails
 * here BEFORE it can ship the next unreachable-to-CN deploy.
 *
 * The gate self-skips while the manifest is absent, so local runs without
 * store credentials stay green during the transition.
 */
const MANIFEST_PATH = "data/image-store.json";

test("published images never hot-link external hosts once the store is live", () => {
  if (!existsSync(MANIFEST_PATH)) {
    test.skip("image store manifest not present yet — gate activates on first bake");
    return;
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const cases = JSON.parse(readFileSync("public/data/cases.json", "utf8"));
  const templates = JSON.parse(readFileSync("public/data/templates.json", "utf8"));

  // Gate phases (manifest.completed):
  //   false/absent — backfill transition: not-yet-baked externals allowed,
  //                  because the next chunk/daily bake will localise them;
  //   "partial"    — bake coverage done but some bases failed upstream on
  //                  both sources: only those failed-marked externals allowed;
  //   true         — strict: no external image host may appear at all.
  const phase = manifest.completed;
  // Bases whose upstream died on BOTH sources carry a "failed" marker and are
  // allowed to stay external until a later backfill retry revives them.
  const failedExternals = new Set(
    Object.entries(manifest.entries || {})
      .filter(([, e]) => e && e.source === "failed")
      .map(([base]) => `case${String(base).replace(/^case/, "")}`),
  );
  if (phase !== true && phase !== "partial") {
    test.skip(`gate phase=${String(phase)} — transition, strict gate not armed yet`);
    return;
  }

  const externals = [];
  for (const c of cases) {
    if (!/^\/(images|uploads)\//.test(String(c.imageUrl || ""))) {
      if (failedExternals.has(`case${c.id}`)) continue;
      externals.push(`case#${c.id} ${c.imageUrl}`);
    }
  }
  for (const t of templates) {
    if (!/^\/(images|uploads)\//.test(String(t.cover || ""))) {
      externals.push(`template#${t.id} ${t.cover}`);
    }
  }

  assert.deepEqual(
    externals,
    [],
    "external image URLs found — mainland browsers cannot reach these hosts; " +
      "run the image bake pipeline instead of hot-linking",
  );
});
