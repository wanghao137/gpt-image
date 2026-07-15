/**
 * SSG-only data access. This module statically imports the full cases.json
 * and templates.json. It is ONLY imported on the server side:
 *
 *   1. data.ts async-imports it inside `if (import.meta.env.SSR)` — which is
 *      dead code in the client build, so Rollup never includes this module.
 *   2. routes.tsx may import it inside getStaticPaths (server-only function).
 *
 * Vite guarantees: `import.meta.env.SSR` is statically replaced at build time.
 * In the client build it's `false`, so any code path importing this module
 * is unreachable and tree-shaken away.
 */
import casesJson from "../../public/data/cases.json";
import templatesJson from "../../public/data/templates.json";
import type { PromptCase, PromptTemplate } from "../types";

export const SSG_ALL_CASES: PromptCase[] = casesJson as PromptCase[];
export const SSG_ALL_TEMPLATES: PromptTemplate[] = templatesJson as PromptTemplate[];
