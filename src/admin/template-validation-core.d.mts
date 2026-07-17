export interface TemplateValidationIssue {
  index: number;
  field: "id" | "title" | "prompt" | "cover" | "category";
  message: string;
}

export interface TemplateValidationInput {
  id?: unknown;
  title?: unknown;
  prompt?: unknown;
  cover?: unknown;
  category?: unknown;
}

export function validateManualTemplates(
  templates: TemplateValidationInput[],
): TemplateValidationIssue[];
