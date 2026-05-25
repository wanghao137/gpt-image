export interface CaseAutomationInput {
  id: string;
  title: string;
  category: string;
  styles: string[];
  scenes: string[];
  tags?: string[];
  imageUrl: string;
  imageAlt?: string;
  prompt: string;
  promptPreview?: string;
  source?: string;
  githubUrl?: string;
  createdAt?: string;
  hidden?: boolean;
}

export interface TemplateAutomationInput {
  id: string;
  title: string;
  category: string;
  tags: string[];
  description: string;
  cover: string;
  prompt: string;
  useWhen: string;
  createdAt?: string;
  sourceType?: "upstream-style" | "derived-case" | "manual";
  sourceLabel?: string;
  sourceUrl?: string;
  derivedFrom?: string[];
}

export interface AutomationOptions {
  overwrite?: boolean;
}

export function makePromptPreview(prompt: string, maxLength?: number): string;
export function inferCaseFields<T extends CaseAutomationInput>(
  caseItem: T,
  options?: AutomationOptions,
): T & {
  tags?: string[];
  imageAlt?: string;
  promptPreview?: string;
};
export function inferTemplateFields<T extends TemplateAutomationInput>(
  template: T,
  options?: AutomationOptions,
): T;
