export type UserCategoryKey =
  | "xhs-cover"
  | "wechat-grid"
  | "merchant-poster"
  | "portrait"
  | "kids-portrait"
  | "3d-ip"
  | "ecommerce"
  | "travel-poster"
  | "brand-kv"
  | "festival"
  | "infographic"
  | "sticker"
  | "ui-screenshot"
  | "poster-general"
  | "illustration"
  | "classical"
  | "storyboard"
  | "architecture"
  | "other";

export const USER_CATEGORY_LABEL: Record<UserCategoryKey, string>;
export const FALLBACK_CATEGORY: "other";

export interface CaseLike {
  title?: string;
  category?: string;
  tags?: string[];
  styles?: string[];
  scenes?: string[];
  promptPreview?: string;
  ratio?: string;
}

/** Sorted [bucket, score] breakdown, highest first. */
export function scoreCase(caseLike: CaseLike): Array<[UserCategoryKey, number]>;

/** Classify into a primary bucket + up to two secondaries. */
export function classifyCase(caseLike: CaseLike): {
  primary: UserCategoryKey;
  secondaries: UserCategoryKey[];
};
