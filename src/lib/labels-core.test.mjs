import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  IDENTITY_OK_LABELS,
  PLATFORM_LABELS,
  platformLabel,
  sceneLabel,
  styleLabel,
  tagLabel,
  templateTagLabel,
} from "./labels-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const filterOptions = JSON.parse(
  readFileSync(join(root, "public", "data", "filter-options.json"), "utf8"),
);
const templates = JSON.parse(
  readFileSync(join(root, "data", "manual", "templates.json"), "utf8"),
);
const templateTags = new Set();
for (const t of templates) {
  for (const tag of t.tags ?? []) templateTags.add(tag);
}

test("every style option renders Chinese (or is an allowlisted identity label)", () => {
  const untranslated = filterOptions.styles.filter(
    (v) => styleLabel(v) === v && !IDENTITY_OK_LABELS.has(v),
  );
  assert.deepEqual(untranslated, []);
});

test("every scene option renders Chinese (or is an allowlisted identity label)", () => {
  const untranslated = filterOptions.scenes.filter(
    (v) => sceneLabel(v) === v && !IDENTITY_OK_LABELS.has(v),
  );
  assert.deepEqual(untranslated, []);
});

test("platform labels cover every platform option in Chinese", () => {
  for (const p of filterOptions.platforms) {
    assert.notEqual(platformLabel(p), p, `platform ${p} untranslated`);
  }
});

test("mixed-pool tagLabel prefers style mapping then scene mapping", () => {
  assert.equal(tagLabel("Anime"), "动漫");
  assert.equal(tagLabel("Game UI"), "游戏 UI");
  assert.equal(tagLabel("xiaohongshu"), "小红书");
});

// Template "适用方向" chips render Chinese on both the templates list and the
// detail page. A raw English tag here means the dictionary is missing an
// entry — fail CI instead of shipping English chips.
test("every template tag renders Chinese (or is an allowlisted identity label)", () => {
  const untranslated = [...templateTags].filter(
    (v) => templateTagLabel(v) === v && !IDENTITY_OK_LABELS.has(String(v).toUpperCase()),
  );
  assert.deepEqual(
    untranslated.sort(),
    [],
    `untranslated template tags: ${untranslated.join(", ")}`,
  );
});
