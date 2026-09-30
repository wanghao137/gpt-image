import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

test("prebuild runs the image pipeline in strict mode", () => {
  assert.match(pkg.scripts.prebuild, /node scripts\/build-images\.mjs --strict/);
});

test("check runs the regression test suite", () => {
  assert.match(pkg.scripts.check, /npm run test/);
});

test("Vercel builds from committed generated data without running external sync", () => {
  // verify-admin-env runs FIRST: a missing/malformed VITE_ADMIN_PASSWORD_HASH
  // must fail the production build instead of silently shipping a passwordless
  // /admin (see src/admin/README.md).
  // check-data-consistency gates the committed data (slug/ratio/etc. required
  // fields) BEFORE tsc/SSG: bad data must fail the deploy loudly instead of
  // shipping a fallback-shell homepage (2026-09-16 incident).
  // The build runs through scripts/vercel-build.mjs (sentinel orchestrator —
  // Vercel re-invokes the build command per deployment and a second pass must
  // never clobber the verified output; 2026-09-30 shell incident), which runs
  // the vercel-build:chain script below.
  const chain = pkg.scripts["vercel-build:chain"];
  assert.equal(pkg.scripts["vercel-build"], "node scripts/vercel-build.mjs");
  assert.match(
    chain,
    /^node scripts\/verify-admin-env\.mjs && node scripts\/split-data\.mjs && node scripts\/check-data-consistency\.mjs && tsc -b/,
  );
  assert.match(chain, /vite-react-ssg build/);
  assert.match(chain, /node scripts\/check-ssg-output\.mjs/);
  assert.match(chain, /npm run postbuild/);
  assert.doesNotMatch(chain, /scripts\/sync\.mjs/);
  assert.equal(vercel.buildCommand, "npm run vercel-build");
  // The orchestrator must actually run the chain and honour the sentinel.
  const orch = readFileSync("scripts/vercel-build.mjs", "utf8");
  assert.match(orch, /vercel-build:chain/);
  assert.match(orch, /\.build-pass-complete/);
});
