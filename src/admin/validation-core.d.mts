export interface ValidationIssue {
  index: number;
  field: string;
  message: string;
}

export declare const CASE_CATEGORIES: string[];

export declare function isKnownStyleToken(token: string): boolean;
export declare function isKnownSceneToken(token: string): boolean;
export declare function isKnownTemplateTag(token: string): boolean;
export declare function isKnownCategory(category: string): boolean;
export declare function isGitHubBlobImage(url: string): boolean;
export declare function styleVocabHint(): string;
export declare function sceneVocabHint(): string;
export declare function validateManualCases(cases: unknown[]): ValidationIssue[];
export declare function validateManualTemplates(templates: unknown[]): ValidationIssue[];
