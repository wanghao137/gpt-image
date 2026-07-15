export const CASE_HYDRATION_ELEMENT_ID = "case-hydration-data";

/** JSON safe to embed inside a script element without allowing tag breakout. */
export function serializeCaseHydrationData(pageData) {
  return JSON.stringify(pageData)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function parseCaseHydrationData(text, slug) {
  if (typeof text !== "string" || !text || !slug) return undefined;
  try {
    const value = JSON.parse(text);
    return value &&
      typeof value === "object" &&
      value.caseData &&
      value.caseData.slug === slug
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
