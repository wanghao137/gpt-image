import { serializeCaseHydrationData } from "./case-hydration-core.mjs";

export const LAB_HYDRATION_ELEMENT_ID = "lab-hydration-data";

// The serializer is JSON-shape agnostic (escapes &, <, >, U+2028/9 so a script
// element can never be broken out of) — reuse it rather than duplicating.
export const serializeLabHydrationData = serializeCaseHydrationData;

export function parseLabHydrationData(text, slug) {
  if (typeof text !== "string" || !text || !slug) return undefined;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && value.item && value.item.slug === slug
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
