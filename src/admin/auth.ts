import { sha256Hex } from "./crypto";

const PASSWORD_HASH: string = (
  import.meta.env.VITE_ADMIN_PASSWORD_HASH || ""
).toLowerCase();

const SESSION_KEY = "admin:unlocked:v1";
const TOKEN_KEY = "admin:gh-token:v1";

/** True when the build was configured with an admin password hash. */
export const adminPasswordRequired = Boolean(PASSWORD_HASH);

/** Did the user already unlock this tab session? */
export function isUnlocked(): boolean {
  if (!adminPasswordRequired) return true;
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

/** Verify a password against the configured hash; on success, mark unlocked. */
export async function tryUnlock(password: string): Promise<boolean> {
  if (!adminPasswordRequired) return true;
  const digest = await sha256Hex(password);
  if (digest !== PASSWORD_HASH) return false;
  sessionStorage.setItem(SESSION_KEY, "1");
  return true;
}

export function lock(): void {
  sessionStorage.removeItem(SESSION_KEY);
  // Don't auto-clear the token — the user may want to reuse it after re-locking.
}

export function readToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function saveToken(token: string): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}
