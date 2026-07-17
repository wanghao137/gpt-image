export interface CaseSearchSource {
  id: string;
  title: string;
  titleEn?: string;
  category?: string;
  userCategory: string;
  userCategories?: string[];
  promptPreview?: string;
  source?: string;
  tags?: string[];
  styles?: string[];
  scenes?: string[];
  platforms?: string[];
}

export interface CaseSearchEntry {
  id: string;
  t: string;
  c?: string;
  uc: string;
  ucs: string[];
  s: string[];
  sc: string[];
  p: string[];
  q: string;
}

export interface CaseSearchFilters {
  query?: string;
  categories?: Set<string>;
  styles?: Set<string>;
  scenes?: Set<string>;
  platforms?: Set<string>;
  favoriteIds?: Set<string> | null;
}

export function createCaseSearchEntry(source: CaseSearchSource): CaseSearchEntry;
export function filterCaseSearchEntries(
  entries: CaseSearchEntry[],
  filters?: CaseSearchFilters,
): CaseSearchEntry[];
export function categoriesForSearchEntries(entries: CaseSearchEntry[]): Set<string>;
