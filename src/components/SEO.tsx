import { Head } from "vite-react-ssg";

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
}

const SITE_URL = "https://gpt-image-6hu.pages.dev";
const SITE_NAME = "GPT-Image 2 中文案例库";
// Default OG card. The SVG ships under /public/og.svg as a 1200x630 baked-in
// card. Most platforms (WeChat, Twitter, LinkedIn) rasterise SVG fine; if a
// PNG is later dropped at /og.png it'll override automatically.
const DEFAULT_OG = `${SITE_URL}/og.svg`;

/**
 * Per-page <head> manager + JSON-LD emitter.
 *
 * Implementation notes:
 *   - `<Head>` (react-helmet-async, via vite-react-ssg) handles meta/link/title.
 *   - JSON-LD ships as a regular DOM `<script type="application/ld+json">` in
 *     the body. Helmet-async strips script tags from its SSR output by default,
 *     and Google/Bing happily pick up JSON-LD wherever it lives in the page.
 *     This keeps structured data reliable across hydration + SSG.
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
}: SEOProps) {
  const fullUrl = path.startsWith("http") ? path : SITE_URL + path;
  const ogImage = image || DEFAULT_OG;
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={fullUrl} />
        {noindex && <meta name="robots" content="noindex, nofollow" />}

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

      {/* JSON-LD lives in body — search engines parse it regardless of placement. */}
      {ldArray.map((data, i) => (
        <script
          key={`ld-${i}`}
          type="application/ld+json"
          // We're emitting trusted, locally-built JSON, never user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
    </>
  );
}

export const SITE = {
  url: SITE_URL,
  name: SITE_NAME,
  defaultOg: DEFAULT_OG,
};
