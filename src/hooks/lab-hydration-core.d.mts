import type { LabItem, LabUrls } from "../types";

export const LAB_HYDRATION_ELEMENT_ID: string;
export interface LabHydrationData {
  item: LabItem;
  urls?: LabUrls;
  prev: { slug: string; t: string } | null;
  next: { slug: string; t: string } | null;
}
export function serializeLabHydrationData(data: LabHydrationData): string;
export function parseLabHydrationData(
  text: unknown,
  slug: string,
): LabHydrationData | undefined;
