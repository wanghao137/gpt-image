import assert from "node:assert/strict";
import test from "node:test";
import {
  applyImageRewrites,
  isRetriableImageFetchFailure,
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

test("failed image processing keeps an existing local fallback instead of the placeholder", () => {
  const remoteUrl = "https://example.test/manual-case.jpg";
  const cases = [{ id: "100004", imageUrl: remoteUrl }];
  const templates = [];

  const { casesRewrites, templatesRewrites } = applyImageRewrites({
    cases,
    templates,
    results: [
      {
        ok: false,
        rec: { kind: "case", targetKind: "case", id: "100004", url: remoteUrl },
        fallbackPath: "/images/case100004.jpg",
        err: new Error("HTTP 503"),
      },
    ],
    placeholderPath: "/images/image-unavailable.svg",
  });

  assert.equal(casesRewrites, 1);
  assert.equal(templatesRewrites, 0);
  assert.equal(cases[0].imageUrl, "/images/case100004.jpg");
});

test("failed image processing without a local fallback preserves the original source", () => {
  const remoteUrl = "https://example.test/new-manual-case.jpg";
  const cases = [{ id: "100099", imageUrl: remoteUrl }];
  const templates = [];

  const { casesRewrites, templatesRewrites } = applyImageRewrites({
    cases,
    templates,
    results: [
      {
        ok: false,
        rec: { kind: "case", targetKind: "case", id: "100099", url: remoteUrl },
        err: new Error("HTTP 503"),
      },
    ],
    placeholderPath: "/images/image-unavailable.svg",
  });

  assert.equal(casesRewrites, 0);
  assert.equal(templatesRewrites, 0);
  assert.equal(cases[0].imageUrl, remoteUrl);
});

test("image fetch retries only transient failures", () => {
  assert.equal(isRetriableImageFetchFailure(new Error("fetch failed")), true);
  assert.equal(isRetriableImageFetchFailure(new Error("HTTP 503 Service Unavailable")), true);
  assert.equal(isRetriableImageFetchFailure(new Error("HTTP 429 Too Many Requests")), true);
  assert.equal(isRetriableImageFetchFailure(new Error("HTTP 404 Not Found")), false);
  // A per-attempt timeout aborts the fetch; that must be retriable so a stalled
  // mirror doesn't fail the whole image build on the first hiccup.
  assert.equal(
    isRetriableImageFetchFailure(new DOMException("The operation was aborted.", "AbortError")),
    true,
  );
  assert.equal(isRetriableImageFetchFailure(new Error("request timed out")), true);
});
