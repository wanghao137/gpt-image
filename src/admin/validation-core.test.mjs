import assert from "node:assert/strict";
import test from "node:test";

import {
  CASE_CATEGORIES,
  isKnownSceneToken,
  isKnownStyleToken,
  isKnownTemplateTag,
  validateManualCases,
  validateManualTemplates,
} from "./validation-core.mjs";
import {
  SCENE_LABELS,
  STYLE_LABELS,
  templateTagLabel,
  IDENTITY_OK_LABELS,
} from "../lib/labels-core.mjs";
import {
  REMOVE_FROM_SCENES,
  REMOVE_FROM_STYLES,
} from "../../scripts/tag-normalize-core.mjs";
import { inferTemplateFields } from "./content-automation-core.mjs";

const baseCase = {
  id: "100001",
  title: "测试案例",
  category: "海报与排版",
  styles: ["Illustration"],
  scenes: ["Commerce"],
  imageUrl: "/uploads/2026-01-01-test.jpg",
  prompt: "完整 Prompt 正文",
};

test("a complete case passes validation", () => {
  assert.deepEqual(validateManualCases([baseCase]), []);
});

test("hidden entries only require an id", () => {
  assert.deepEqual(validateManualCases([{ id: "412", hidden: true }]), []);
  assert.notEqual(validateManualCases([{ hidden: true }]).length, 0);
});

test("missing required fields and duplicate ids are reported per entry", () => {
  const issues = validateManualCases([
    { ...baseCase, id: "100001", title: "", imageUrl: "", prompt: "" },
    { ...baseCase, id: "100001" },
  ]);
  const fields = issues.map((issue) => issue.field);
  assert.deepEqual(fields, ["title", "imageUrl", "prompt", "id"]);
  assert.match(issues[3].message, /ID 重复/);
});

test("categories outside the fixed list are rejected", () => {
  const issues = validateManualCases([{ ...baseCase, category: "不存在的分类" }]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /不在固定分类列表/);
  assert.equal(CASE_CATEGORIES.length, 13);
});

test("github blob image urls are rejected", () => {
  const issues = validateManualCases([
    {
      ...baseCase,
      imageUrl: "https://github.com/foo/bar/blob/main/img.png",
    },
  ]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /blob/);
});

test("style tokens outside the label vocabulary are rejected with a fix hint", () => {
  const issues = validateManualCases([{ ...baseCase, styles: ["Oil Painting"] }]);
  // Only invalid once labels-core lacks the mapping; the mapping itself is
  // asserted separately below so adding the label flips this test too.
  if (!("Oil Painting" in STYLE_LABELS)) {
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /style「Oil Painting」/);
    assert.match(issues[0].message, /labels-core\.mjs/);
  } else {
    assert.deepEqual(issues, []);
  }
});

test("legacy and removable style/scene tokens stay valid (they normalize away)", () => {
  assert.equal(isKnownStyleToken("Brand Identity"), true); // synonym → Brand → dropped from styles
  assert.equal(isKnownStyleToken("Poster"), true); // deliberately removed from styles axis
  assert.equal(isKnownStyleToken("3D"), true); // synonym → 3D Render
  assert.equal(isKnownSceneToken("Editorial"), true); // deliberately removed from scenes axis
  assert.equal(isKnownStyleToken("NoSuchStyle"), false);
  assert.equal(isKnownSceneToken("NoSuchScene"), false);
});

test("every vocabulary token satisfies the validators (self-consistency)", () => {
  for (const token of Object.keys(STYLE_LABELS)) {
    assert.equal(isKnownStyleToken(token), true, `style token ${token}`);
  }
  for (const token of Object.keys(SCENE_LABELS)) {
    assert.equal(isKnownSceneToken(token), true, `scene token ${token}`);
  }
  for (const token of REMOVE_FROM_STYLES) {
    assert.equal(isKnownStyleToken(token), true, `removed style token ${token}`);
  }
  for (const token of REMOVE_FROM_SCENES) {
    assert.equal(isKnownSceneToken(token), true, `removed scene token ${token}`);
  }
});

test("templates: required fields, kebab ids, category whitelist, tag vocabulary", () => {
  const good = {
    id: "merchant-promo-poster",
    title: "模板",
    category: "海报与排版",
    tags: ["poster", "commerce"],
    description: "d",
    cover: "/uploads/a.jpg",
    prompt: "p",
    useWhen: "u",
  };
  assert.deepEqual(validateManualTemplates([good]), []);

  const issues = validateManualTemplates([
    { ...good, id: "Bad_Id", category: "未知分类", tags: ["unknown-tag-xyz"] },
  ]);
  const fields = issues.map((issue) => issue.field);
  assert.deepEqual(fields, ["category", "id", "tags"]);
});

test("template sourceType must use the fixed enum", () => {
  const issues = validateManualTemplates([
    {
      id: "t-one",
      title: "模板",
      category: "UI 与界面",
      cover: "/uploads/a.jpg",
      prompt: "p",
      sourceType: "weird",
    },
  ]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /sourceType/);
});

test("smart-fill template hints only produce resolvable tags (guards the CI label test)", () => {
  assert.equal(typeof inferTemplateFields, "function");
  for (const category of CASE_CATEGORIES) {
    const filled = inferTemplateFields(
      {
        id: "t-hint",
        title: "测试模板",
        category,
        tags: [],
        description: "",
        cover: "/uploads/c.jpg",
        prompt: "p",
        useWhen: "",
      },
      { overwrite: true },
    );
    for (const tag of filled.tags ?? []) {
      const resolvable =
        templateTagLabel(tag) !== tag || IDENTITY_OK_LABELS.has(String(tag).toUpperCase());
      assert.equal(resolvable, true, `category ${category} hint tag "${tag}" is unresolvable`);
    }
  }
});

test("isKnownTemplateTag resolves template tag chains", () => {
  assert.equal(isKnownTemplateTag("poster"), true); // TEMPLATE_TAG_LABELS
  assert.equal(isKnownTemplateTag("Illustration"), true); // falls through to style map
  assert.equal(isKnownTemplateTag("xiaohongshu"), true); // platform map
  assert.equal(isKnownTemplateTag("totally-unknown"), false);
});
