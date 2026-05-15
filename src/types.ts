export interface PromptCase {
  id: string;
  title: string;
  category: string;
  tags: string[];
  styles: string[];
  scenes: string[];
  imageUrl: string;
  imageAlt?: string;
  prompt: string;
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
