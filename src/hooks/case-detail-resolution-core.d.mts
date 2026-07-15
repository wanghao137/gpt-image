import type { PromptCase } from "../types";
import type { CaseIndexEntry } from "../lib/data";

export function caseIdFromSlug(slug: unknown): string | undefined;
export function findCaseIndexEntry(
  index: CaseIndexEntry[],
  slug: string,
): CaseIndexEntry | undefined;
export function findCaseInShard(
  shard: PromptCase[],
  slug: string,
  fallbackId?: string,
): PromptCase | undefined;
