/**
 * Browser-native crypto helpers.
 * We use the Web Crypto API so the admin panel ships zero crypto deps.
 */

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─────────────────────────────────────── password hashing (PBKDF2) ──
//
// The admin unlock is only a "UI gate" (the real write gate is the GitHub
// PAT), but the stored hash ships in the public bundle, so it must not be
// trivially reversible. The old scheme was a single unsalted SHA-256 — instant
// to crack against a rainbow table / offline brute force. We now use salted
// PBKDF2-SHA-256 with a high iteration count.
//
// Stored format (in VITE_ADMIN_PASSWORD_HASH):
//   pbkdf2$<iterations>$<saltBase64>$<hashBase64>
// Legacy 64-char hex SHA-256 values are still accepted (with a console warning)
// so existing deployments keep working until the env var is regenerated.

const PBKDF2_ITERATIONS = 210000;
const PBKDF2_HASH = "SHA-256";
const PBKDF2_KEY_BITS = 256;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2Bits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: PBKDF2_HASH },
    keyMaterial,
    PBKDF2_KEY_BITS,
  );
  return new Uint8Array(bits);
}

/** Constant-time-ish comparison of two equal-length byte arrays. */
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Hex string → bytes (for legacy SHA-256 comparison). */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Produce a salted PBKDF2 hash string for a password. Used by the generator
 * (scripts/admin-hash.mjs mirrors this format with node:crypto) and available
 * for any in-app re-hashing.
 */
export async function hashPassword(
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Bits(password, salt, iterations);
  return `pbkdf2$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

/**
 * Verify a password against a stored hash. Accepts the new
 * `pbkdf2$iter$salt$hash` format and the legacy 64-char SHA-256 hex.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const value = (stored || "").trim();
  if (!value) return false;

  if (value.startsWith("pbkdf2$")) {
    const [, iterStr, saltB64, hashB64] = value.split("$");
    const iterations = Number(iterStr);
    if (!Number.isFinite(iterations) || iterations <= 0 || !saltB64 || !hashB64) {
      return false;
    }
    const salt = base64ToBytes(saltB64);
    const expected = base64ToBytes(hashB64);
    const actual = await pbkdf2Bits(password, salt, iterations);
    return timingSafeEqualBytes(actual, expected);
  }

  // Legacy unsalted SHA-256 hex. Still accepted so old deployments work, but
  // it's weak — regenerate VITE_ADMIN_PASSWORD_HASH via `npm run admin:hash`.
  if (/^[0-9a-f]{64}$/i.test(value)) {
    if (typeof console !== "undefined") {
      console.warn(
        "[admin] VITE_ADMIN_PASSWORD_HASH uses the legacy unsalted SHA-256 " +
          "format. Regenerate it with `npm run admin:hash` for salted PBKDF2.",
      );
    }
    const actual = hexToBytes(await sha256Hex(password));
    const expected = hexToBytes(value.toLowerCase());
    return timingSafeEqualBytes(actual, expected);
  }

  return false;
}

/** Convert a binary File/Blob into a base64 string (no data: prefix). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => {
      const result = reader.result as string;
      // result looks like "data:image/jpeg;base64,XXXX" — strip the prefix.
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/** Encode a UTF-8 string to base64 (so non-ASCII case titles round-trip safely). */
export function utf8ToBase64(text: string): string {
  // btoa() only handles latin-1; this is the canonical UTF-8-safe trick.
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Decode base64 → UTF-8 string. */
export function base64ToUtf8(b64: string): string {
  // GitHub returns base64 with newlines; strip them.
  const clean = b64.replace(/\s/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
