export interface AudienceTaskEntry {
  id: "creator" | "merchant" | "designer";
  eyebrow: string;
  title: string;
  description: string;
  categories: string[];
  href: string;
  action: string;
}

export const AUDIENCE_TASK_ENTRIES: AudienceTaskEntry[];
