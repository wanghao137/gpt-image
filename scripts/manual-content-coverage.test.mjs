import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Regeneration coverage gate.
 *
 * Every non-hidden manual case and every manual template MUST be present in
 * the generated public/data output. This is the CI backstop for the failure
 * class where a regenerate run silently produces stale shards (e.g. sync
 * --optional swallowing a non-upstream pipeline error and exiting 0):
 * without this assertion the workflow goes green, the publish-status panel
 * says "已上线", and the content is actually invisible — the exact shape of
 * the 2026-08-24..26 incident.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

test("every non-hidden manual case is present in generated public data", () => {
  const manual = readJson("data/manual/cases.json");
  const published = new Set(readJson("public/data/cases.json").map((c) => String(c.id)));
  const missing = manual
    .filter((c) => c && c.hidden !== true && String(c.id ?? "").trim())
    .map((c) => String(c.id))
    .filter((id) => !published.has(id));
  assert.deepEqual(
    missing,
    [],
    `manual cases missing from public/data/cases.json (regeneration is stale or content is stuck off-line): ${missing.join(", ")}`,
  );
});

test("every manual template is present in generated templates data", () => {
  const manual = readJson("data/manual/templates.json");
  const published = new Set(readJson("public/data/templates.json").map((t) => String(t.id)));
  const missing = manual
    .map((t) => String(t.id ?? "").trim())
    .filter(Boolean)
    .filter((id) => !published.has(id));
  assert.deepEqual(
    missing,
    [],
    `manual templates missing from public/data/templates.json: ${missing.join(", ")}`,
  );
});
