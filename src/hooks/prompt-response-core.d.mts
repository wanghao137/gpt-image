export interface PromptBundle {
  prompt: string;
  promptEn: string;
  promptZh: string;
}

export function parsePromptBundle(text: string): PromptBundle;
export function parsePromptPayload(text: string): string;
export function readPromptBundleResponse(response: Response, url?: string): Promise<PromptBundle>;
export function readPromptResponse(response: Response, url?: string): Promise<string>;
