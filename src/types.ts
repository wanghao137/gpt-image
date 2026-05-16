export interface PromptCase {
  id: string;
  title: string;
  category: string;
  tags: string[];
  styles: string[];
  scenes: string[];
  imageUrl: string;
  imageAlt?: string;
  /**
   * Short preview shown on the card. Full prompt is loaded on demand from
   * `data/prompts/{id}.json` via the `usePrompt` hook.
   */
  promptPreview?: string;
  source?: string;
  githubUrl?: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  category: string;
  tags: string[];
  description: string;
  cover: string;
  prompt: string;
  useWhen: string;
}
