#!/usr/bin/env node
/**
 * Fail production builds when the admin password gate is silently disabled.
 *
 * Why this exists: the live Vercel bundle shipped for weeks with
 * VITE_ADMIN_PASSWORD_HASH unset (the variable only existed as a GitHub
 * Actions variable for the GH Pages mirror), so /admin ran in no-password
 * mode while the README documented a password gate. A build-time assertion
 * turns that class of drift into a loud, immediate failure.
 */

const PBKDF2_FORMAT = /^pbkdf2\$([1-9]\d+)\$[A-Za-z0-9+/]{16,}={0,2}\$[A-Za-z0-9+/]{40,}={0,2}$/;
const LEGACY_SHA256 = /^[0-9a-f]{64}$/i;

/** @returns {{ ok: boolean, reason?: string }} */
export function validateAdminPasswordHash(hash) {
  const value = String(hash ?? "").trim();
  if (!value) {
    return { ok: false, reason: "VITE_ADMIN_PASSWORD_HASH is empty — the /admin password gate would be DISABLED" };
  }
  if (PBKDF2_FORMAT.test(value)) {
    return { ok: true };
  }
  if (LEGACY_SHA256.test(value)) {
    return {
      ok: true,
      reason: "VITE_ADMIN_PASSWORD_HASH uses the legacy unsalted SHA-256 format; regenerate with `npm run admin:hash`",
    };
  }
  return {
    ok: false,
    reason:
      "VITE_ADMIN_PASSWORD_HASH is malformed (expected pbkdf2$<iter>$<salt>$<hash>); regenerate with `npm run admin:hash`",
  };
}

function main() {
  // Enforce on Vercel builds (the live site), or anywhere that opts in.
  // CI_ADMIN_HASH_ENFORCE=1 lets GitHub Pages or other pipelines adopt the
  // same gate; SKIP_ADMIN_HASH_CHECK=1 is the explicit escape hatch.
  const enforce =
    process.env.VERCEL === "1" || process.env.CI_ADMIN_HASH_ENFORCE === "1";
  if (!enforce || process.env.SKIP_ADMIN_HASH_CHECK === "1") {
    console.log("admin env check: skipped (not a Vercel build)");
    return;
  }

  const result = validateAdminPasswordHash(process.env.VITE_ADMIN_PASSWORD_HASH);
  if (!result.ok) {
    console.error(`✖ ${result.reason}`);
    console.error(
      "  Fix: npm run admin:hash  →  npx vercel env add VITE_ADMIN_PASSWORD_HASH production  →  redeploy",
    );
    process.exit(1);
  }
  if (result.reason) {
    console.warn(`! ${result.reason}`);
  }
  console.log("admin env check: VITE_ADMIN_PASSWORD_HASH present and well-formed");
}

main();
