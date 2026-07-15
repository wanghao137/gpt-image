/**
 * SSG-only data access for the full cases.json. This module statically imports
 * the 7+ MB cases.json and is ONLY loaded on the server side:
 *
 *   data.ts async-imports it inside `if (import.meta.env.SSR)` — which is
 *   dead code in the client build, so Rollup never includes this module.
 *
 * Templates are NOT loaded here — they're small enough to be statically
 * imported directly in data.ts for both SSG and client.
 */
import casesJson from "../../public/data/cases.json";
import type { PromptCase } from "../types";

export const SSG_ALL_CASES: PromptCase[] = casesJson as PromptCase[];
