export interface BrandConfig {
  name: string;
  shortName: string;
  /** 当前生图模型的对外展示名（如 GPT-Image 2.5）。 */
  model: string;
  latinName: string;
  productName: string;
  siteTitle: string;
  adminTitle: string;
  adminShortTitle: string;
  faviconVersion: string;
  siteUrl: string;
  description: string;
  fallbackDescription: string;
  keywords: string;
  sourceCredit: string;
}

export const BRAND: BrandConfig;
export function formatSiteTitle(title: string): string;
