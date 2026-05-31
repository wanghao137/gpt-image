import test from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes, webcrypto } from "node:crypto";

// These tests pin the password-hash contract shared by:
//   - scripts/admin-hash.mjs           (generator, node:crypto)
//   - src/admin/crypto.ts verifyPassword (verifier, Web Crypto)
// They must produce/accept the SAME `pbkdf2$iter$salt$hash` string, otherwise
// a freshly generated hash wouldn't unlock the admin panel.

const ITERATIONS = 210000;
const KEY_BYTES = 32;

function generate(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_BYTES, "sha256");
  return `pbkdf2$${ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

// Mirror of src/admin/crypto.ts verifyPassword, using node's webcrypto so the
// exact same code path (importKey → deriveBits) is exercised here.
async function verify(password, stored) {
  const value = String(stored || "").trim();
  if (!value.startsWith("pbkdf2$")) return false;
  const [, iterStr, saltB64, hashB64] = value.split("$");
  const iterations = Number(iterStr);
  if (!Number.isFinite(iterations) || iterations <= 0 || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const actual = Buffer.from(new Uint8Array(bits));
  return actual.equals(expected);
}

test("generated PBKDF2 hash verifies with the Web Crypto path", async () => {
  const stored = generate("correct horse battery staple");
  assert.match(stored, /^pbkdf2\$210000\$[^$]+\$[^$]+$/);
  assert.equal(await verify("correct horse battery staple", stored), true);
});

test("wrong password does not verify", async () => {
  const stored = generate("s3cret-pass");
  assert.equal(await verify("s3cret-pas", stored), false);
  assert.equal(await verify("", stored), false);
});

test("a different salt yields a different hash for the same password", () => {
  const a = generate("same-password");
  const b = generate("same-password");
  assert.notEqual(a, b, "salts must differ so identical passwords hash differently");
});

test("malformed stored values are rejected", async () => {
  assert.equal(await verify("pw", ""), false);
  assert.equal(await verify("pw", "pbkdf2$abc$salt$hash"), false);
  assert.equal(await verify("pw", "pbkdf2$210000$$"), false);
});
