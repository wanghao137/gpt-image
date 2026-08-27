import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import { validateAdminPasswordHash } from "./verify-admin-env.mjs";

test("accepts well-formed pbkdf2 hashes", () => {
  const salt = Buffer.from("0123456789abcdef").toString("base64");
  const digest = createHash("sha256").update("x").digest("base64");
  assert.deepEqual(
    validateAdminPasswordHash(`pbkdf2$210000$${salt}$${digest}`),
    { ok: true },
  );
});

test("rejects empty and malformed hashes", () => {
  assert.equal(validateAdminPasswordHash("").ok, false);
  assert.equal(validateAdminPasswordHash(undefined).ok, false);
  assert.equal(validateAdminPasswordHash("pbkdf2$abc$notbase64$nope").ok, false);
  assert.equal(validateAdminPasswordHash("short").ok, false);
});

test("accepts legacy sha256 with a warning reason", () => {
  const hex = createHash("sha256").update("pw").digest("hex");
  const result = validateAdminPasswordHash(hex);
  assert.equal(result.ok, true);
  assert.match(result.reason, /legacy/);
});
