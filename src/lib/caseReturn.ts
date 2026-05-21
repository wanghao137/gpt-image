const CASE_RETURN_KEY = "taostudio.caseReturn";
const MAX_AGE_MS = 1000 * 60 * 60;

export interface CaseReturnTarget {
  id: string;
  path: string;
  savedAt: number;
}

export function caseReturnPath(location: Pick<Location, "pathname" | "search" | "hash">) {
  return `${location.pathname}${location.search}${location.hash}`;
}

function currentPath() {
  if (typeof window === "undefined") return "/cases";
  return caseReturnPath(window.location);
}

function isFresh(target: CaseReturnTarget) {
  return Date.now() - target.savedAt < MAX_AGE_MS;
}

export function rememberCaseReturn(id: string, path = currentPath()) {
  if (typeof window === "undefined" || !id) return;
  const target: CaseReturnTarget = { id, path, savedAt: Date.now() };
  try {
    window.sessionStorage.setItem(CASE_RETURN_KEY, JSON.stringify(target));
  } catch {
    // Session storage can be unavailable in strict privacy modes.
  }
}

export function readCaseReturn(): CaseReturnTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CASE_RETURN_KEY);
    if (!raw) return null;
    const target = JSON.parse(raw) as CaseReturnTarget;
    if (!target?.id || !target?.path || !isFresh(target)) return null;
    return target;
  } catch {
    return null;
  }
}

export function clearCaseReturn() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CASE_RETURN_KEY);
  } catch {
    // Ignore storage failures.
  }
}
