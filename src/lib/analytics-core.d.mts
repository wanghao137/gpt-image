export function normalizeAnalyticsPath(input: string): string;
export function shouldTrackAnalyticsPath(input: string): boolean;
export function classifyDevice(userAgent?: string): "Bot" | "Tablet" | "Mobile" | "Desktop";
export function classifyBrowser(userAgent?: string): "Edge" | "Opera" | "Firefox" | "Chrome" | "Safari" | "Other";
export function classifyOS(userAgent?: string): "iOS" | "Android" | "Windows" | "macOS" | "Linux" | "Other";
export function buildClientPageViewPayload(input: {
  href: string;
  referrer?: string;
}): {
  url: string;
  path: string;
  referrer: string;
};
export function toDateKey(date?: Date, timeZone?: string): string;
export function mergeRankedMetrics(
  groups: Array<Array<{ label: string; value: number }>>,
  limit?: number,
): Array<{ label: string; value: number }>;
