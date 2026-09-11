export const YOUMIND_X_MEDIA_RE: RegExp;
export const WSRV_BASE: string;
export function xOriginalUrl(src: unknown): string | null;
export function wsrvTransformUrl(
  innerUrl: string,
  opts?: { width?: number; quality?: number; format?: string },
): string;
export function wsrvPassthroughUrl(absoluteUrl: string): string;
export function withErrorRedirect(primaryUrl: string, fallbackUrl: string): string;
export function xOrigWsrvTransformUrl(
  absoluteUrl: string,
  opts?: { width?: number; quality?: number; format?: string },
): string;
