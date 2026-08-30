/**
 * SSG-only data access for the 4K 实验室 registry. Mirrors data-ssg.ts:
 * statically imports the source files and is ONLY loaded server-side —
 * data-lab.ts async-imports it inside `if (import.meta.env.SSR)`, which is
 * dead code in the client build, so neither the registry nor the URL map
 * ever enters the browser bundle.
 */
import labJson from "../../data/manual/lab.json";
import labUrlsJson from "../../public/data/lab-urls.json";
import type { LabItem, LabUrls } from "../types";

export const SSG_LAB_ITEMS: LabItem[] = (labJson as LabItem[]).filter((i) => !i.hidden);

/** slug → build-time image URLs (same-origin baked variants with COS fallback). */
export const SSG_LAB_URLS = labUrlsJson as Record<string, LabUrls>;
