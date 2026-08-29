/**
 * SSG-only data access for the full 4K 实验室 registry. Mirrors data-ssg.ts:
 * statically imports data/manual/lab.json and is ONLY loaded server-side —
 * data-lab.ts async-imports it inside `if (import.meta.env.SSR)`, which is
 * dead code in the client build, so the registry never enters the browser
 * bundle.
 */
import labJson from "../../data/manual/lab.json";
import type { LabItem } from "../types";

export const SSG_LAB_ITEMS: LabItem[] = (labJson as LabItem[]).filter((i) => !i.hidden);
