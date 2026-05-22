export interface BrandConfig {
  name: string;
  shortName: string;
  latinName: string;
  productName: string;
  siteTitle: string;
  siteUrl: string;
  description: string;
  fallbackDescription: string;
  keywords: string;
  sourceCredit: string;
}

export const BRAND: BrandConfig;
export function formatSiteTitle(title: string): string;
