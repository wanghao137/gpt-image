import assert from "node:assert/strict";
import test from "node:test";

import { validateManualTemplates } from "./template-validation-core.mjs";

test("template validation requires every field marked required in the editor", () => {
  const issues = validateManualTemplates([
    { id: "template-1", title: "", prompt: "", cover: "", category: "" },
  ]);
  assert.deepEqual(
    issues.map((issue) => issue.field),
    ["title", "prompt", "cover", "category"],
  );
});

test("template validation rejects duplicate ids", () => {
  const complete = {
    title: "模板",
    prompt: "Prompt",
    cover: "/cover.webp",
    category: "海报与排版",
  };
  const issues = validateManualTemplates([
    { ...complete, id: "same" },
    { ...complete, id: "same" },
  ]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /ID 重复/);
});

test("complete templates pass validation", () => {
  assert.deepEqual(
    validateManualTemplates([
      {
        id: "template-1",
        title: "模板",
        prompt: "Prompt",
        cover: "/cover.webp",
        category: "海报与排版",
      },
    ]),
    [],
  );
});
