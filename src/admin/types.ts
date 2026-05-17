/** Admin-side data shapes (mirror of data/manual/cases.json entries). */

export interface ManualCase {
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
  /** When true, this entry hides an upstream case with the same id. */
  hidden?: boolean;
}

export interface ManualTemplate {
  id: string;
  title: string;
  category: string;
  tags: string[];
  description: string;
  cover: string;
  prompt: string;
  useWhen: string;
}

/** Repo state we track locally — the server SHA is needed for safe writes. */
export interface FileState<T> {
  data: T;
  /** GitHub SHA of the version we loaded; null when the file does not exist yet. */
  sha: string | null;
  /** True when we have unsaved local changes against `data`. */
  dirty: boolean;
}

export type ConnectionStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "connected"; login: string }
  | { kind: "error"; message: string };
