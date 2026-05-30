import { Head } from "vite-react-ssg";
import { BRAND, formatSiteTitle } from "../lib/brand";
import { absoluteUrl } from "../lib/seo-url.mjs";

interface SEOProps {
  title: string;
  description: string;
  /** Absolute URL or path; prepended with siteUrl for og:url + canonical. */
  path?: string;
  image?: string;
  imageAlt?: string;
  /** JSON-LD structured data, rendered as inline <script> tags in the body. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
  /**
   * Same-origin URL(s) to `<link rel="preload" as="fetch">`. Used by the case
   * detail page to warm the per-case prompt JSON during HTML parse, so the
   * `usePrompt` fetch resolves from cache instead of adding a round-trip after
   * hydration — important on weak mobile networks where the SSG'd page is
   * already painted but the prompt (the page's core content) would otherwise
   * wait for JS + a fresh request.
   */
  preloadFetch?: string[];
}

const SITE_URL = BRAND.siteUrl;
const SITE_NAME = BRAND.name;
// Default OG card. The SVG ships under /public/og.svg as a 1200x630 baked-in
// card. Most platforms (WeChat, Twitter, LinkedIn) rasterise SVG fine; if a
// PNG is later dropped at /og.png it'll override automatically.
const DEFAULT_OG = `${SITE_URL}/og.svg`;

/**
 * Per-page <head> manager + JSON-LD emitter.
 *
 * Implementation notes:
 *   - `<Head>` (vite-react-ssg) handles meta/link/title. It STRIPS `<script>`
 *     tags from its SSG output, so JSON-LD ships as a real DOM
 *     `<script type="application/ld+json">` in the body, where Google/Bing
 *     parse it regardless of placement. This is the SEO-correct placement and
 *     matches what the static HTML must contain for crawlers.
 *
 * Usage at the top of every page component:
 *   <SEO title="..." description="..." path="/case/foo" image="..." />
 */
export function SEO({
  title,
  description,
  path = "/",
  image,
  imageAlt,
  jsonLd,
  noindex,
  preloadFetch,
}: SEOProps) {
  const fullUrl = path.startsWith("http") ? path : SITE_URL + path;
  // Social scrapers (WeChat / Twitter / Facebook / Feishu) require an
  // ABSOLUTE image URL — they don't resolve a relative `/images/x.jpg`
  // against the page URL, they just drop it. Every case page used to emit a
  // relative og:image (because `transformUrl` returns local /images/* paths
  // unchanged), producing image-less share cards. Force absolute here.
  const ogImage = absoluteUrl(SITE_URL, image || DEFAULT_OG);
  const fullTitle = formatSiteTitle(title);
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={fullUrl} />
        {noindex && <meta name="robots" content="noindex, nofollow" />}

        {/* Warm same-origin resources (e.g. the per-case prompt JSON) during
            HTML parse so they resolve from cache after hydration. */}
        {preloadFetch?.map((href) => (
          <link key={href} rel="preload" as="fetch" href={href} crossOrigin="anonymous" />
        ))}

        {/* Open Graph */}
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={fullUrl} />
        <meta property="og:image" content={ogImage} />
        {imageAlt && <meta property="og:image:alt" content={imageAlt} />}
        <meta property="og:locale" content="zh_CN" />

        {/* Twitter / X */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={fullTitle} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
      </Head>

      {/* JSON-LD lives in body — search engines parse it regardless of
          placement. `suppressHydrationWarning` keeps a (cosmetic) inner-HTML
          diff from escalating into a fatal hydration bailout. */}
      {ldArray.map((data, i) => (
        <script
          key={`ld-${i}`}
          type="application/ld+json"
          suppressHydrationWarning
          // Trusted, locally-built JSON, never user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
    </>
  );
}

export const SITE = {
  url: SITE_URL,
  name: SITE_NAME,
  latinName: BRAND.latinName,
  productName: BRAND.productName,
  defaultOg: DEFAULT_OG,
};
