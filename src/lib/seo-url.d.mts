/** Resolve a path or URL to an absolute URL against `siteUrl`. */
export function absoluteUrl(siteUrl: string, pathOrUrl: string | null | undefined): string;

/** Parse a ratio string like "9:16" into [w, h], or null when unparseable. */
export function parseRatio(ratio: string | null | undefined): [number, number] | null;

/** Integer image dimensions for schema.org ImageObject from a ratio + width. */
export function imageDimensionsForRatio(
  ratio: string | null | undefined,
  width?: number,
): { width: number; height: number };

/** Collapse whitespace and hard-truncate with an ellipsis. */
export function clipText(value: string | null | undefined, max: number): string;

/** JSON.stringify that escapes HTML/script-context chars for safe inline <script> embedding. */
export function jsonLdSafeStringify(data: unknown): string;

/** Derive a case's SEO title + description from its content (not stored). */
export function deriveCaseSeo(
  promptCase: { title?: string; promptPreview?: string },
  categoryLabel: string,
): { seoTitle: string; seoDescription: string };
