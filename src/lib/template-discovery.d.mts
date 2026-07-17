import type { PromptTemplate } from "../types";

export type TemplateSortMode = "curated" | "newest" | "title";
export interface TemplateVariable {
  name: string;
  defaultValue: string;
}

export function templateCategories(
  templates: readonly PromptTemplate[],
): Array<{ label: string; count: number }>;
export function filterAndSortTemplates<T extends PromptTemplate>(
  templates: readonly T[],
  options?: { query?: string; category?: string; sort?: TemplateSortMode },
): T[];
export function extractTemplateVariables(prompt: string): TemplateVariable[];
export function derivedCaseSearchHref(caseId: string): string;
