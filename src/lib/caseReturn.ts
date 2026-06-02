const CASE_RETURN_KEY = "taostudio.caseReturn";
const MAX_AGE_MS = 1000 * 60 * 60;

export interface CaseReturnTarget {
  id: string;
  path: string;
  savedAt: number;
  scrollY?: number;
  viewportHeight?: number;
  viewportWidth?: number;
  targetTop?: number;
  targetHeight?: number;
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

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function captureViewport(id: string): Partial<CaseReturnTarget> {
  if (typeof window === "undefined") return {};
  const el = window.document?.getElementById(`case-${id}`);
  const rect = el?.getBoundingClientRect();
  return {
    scrollY: finiteNumber(window.scrollY),
    viewportHeight: finiteNumber(window.innerHeight),
    viewportWidth: finiteNumber(window.innerWidth),
    targetTop: finiteNumber(rect?.top),
    targetHeight: finiteNumber(rect?.height),
  };
}

function writeCaseReturn(target: CaseReturnTarget) {
  try {
    window.sessionStorage.setItem(CASE_RETURN_KEY, JSON.stringify(target));
  } catch {
    // Session storage can be unavailable in strict privacy modes.
  }
}

export function rememberCaseReturn(id: string, path = currentPath()) {
  if (typeof window === "undefined" || !id) return;
  writeCaseReturn({ id, path, savedAt: Date.now(), ...captureViewport(id) });
}

export function refreshCaseReturn(id: string, path = currentPath()) {
  if (typeof window === "undefined" || !id) return;
  const previous = readCaseReturn();
  writeCaseReturn({ ...previous, id, path, savedAt: Date.now() });
}

export function readCaseReturn(): CaseReturnTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CASE_RETURN_KEY);
    if (!raw) return null;
    const target = JSON.parse(raw) as CaseReturnTarget;
    if (!target?.id || !target?.path || !isFresh(target)) return null;
    return {
      ...target,
      scrollY: finiteNumber(target.scrollY),
      viewportHeight: finiteNumber(target.viewportHeight),
      viewportWidth: finiteNumber(target.viewportWidth),
      targetTop: finiteNumber(target.targetTop),
      targetHeight: finiteNumber(target.targetHeight),
    };
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
