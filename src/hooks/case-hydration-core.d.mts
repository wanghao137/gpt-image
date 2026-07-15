import type { PromptCase } from "../types";

export const CASE_HYDRATION_ELEMENT_ID: string;
export interface CaseHydrationData {
  caseData: PromptCase;
  related: PromptCase[];
  prev?: PromptCase;
  next?: PromptCase;
}
export function serializeCaseHydrationData(pageData: CaseHydrationData): string;
export function parseCaseHydrationData(
  text: unknown,
  slug: string,
): CaseHydrationData | undefined;
