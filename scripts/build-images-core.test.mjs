import assert from "node:assert/strict";
import test from "node:test";
import {
  applyImageRewrites,
  shouldProcessExistingVariants,
} from "./build-images-core.mjs";

test("image rewrites are scoped to each case or template record, not only the source URL", () => {
  const sharedUrl = "https://example.test/shared-source.jpg";
  const cases = [{ id: "100020", imageUrl: sharedUrl }];
  const templates = [{ id: "derived-brand-kv-system", cover: sharedUrl }];

  const { casesRewrites, templatesRewrites } = applyImageRewrites({
    cases,
    templates,
    results: [
      {
        ok: true,
        rec: { kind: "case", targetKind: "case", id: "100020", url: sharedUrl },
        canonicalPath: "/images/case100020.jpg",
      },
      {
        ok: true,
        rec: {
          kind: "template",
          targetKind: "template",
          id: "derived-brand-kv-system",
          url: sharedUrl,
        },
        canonicalPath: "/images/templatederived-brand-kv-system.jpg",
      },
    ],
    placeholderPath: "/images/image-unavailable.svg",
  });

  assert.equal(casesRewrites, 1);
  assert.equal(templatesRewrites, 1);
  assert.equal(cases[0].imageUrl, "/images/case100020.jpg");
  assert.equal(templates[0].cover, "/images/templatederived-brand-kv-system.jpg");
});

test("manual cases and template covers are refreshed even when old variants already exist", () => {
  assert.equal(
    shouldProcessExistingVariants({
      force: false,
      allVariantsExist: true,
      rec: { targetKind: "case", id: "100020" },
    }),
    true,
  );
  assert.equal(
    shouldProcessExistingVariants({
      force: false,
      allVariantsExist: true,
      rec: { targetKind: "template", id: "derived-brand-kv-system" },
    }),
    true,
  );
  assert.equal(
    shouldProcessExistingVariants({
      force: false,
      allVariantsExist: true,
      rec: { targetKind: "case", id: "441" },
    }),
    false,
  );
  assert.equal(
    shouldProcessExistingVariants({
      force: false,
      allVariantsExist: false,
      rec: { targetKind: "case", id: "441" },
    }),
    true,
  );
});
