import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ALL_CASES, casesByUserCategory } from "../lib/data";
import { getUserCategoryBySlug, USER_CATEGORIES } from "../lib/userCategories";
import { CaseGrid } from "../components/CaseGrid";
import { SEO, SITE } from "../components/SEO";
import { useFavorites } from "../hooks/useFavorites";
import NotFoundPage from "./NotFoundPage";

/**
 * /category/:slug — landing page for one user-intent bucket.
 * Pre-rendered at build time for every slug in USER_CATEGORIES, so each
 * bucket has its own SEO surface (e.g. "小红书封面 案例库" can rank).
 */
export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const meta = slug ? getUserCategoryBySlug(slug) : undefined;
  const list = useMemo(
    () => (meta ? casesByUserCategory(meta.key) : []),
    [meta],
  );
  const { ids, toggle } = useFavorites();

  if (!meta) return <NotFoundPage />;

  const seoTitle = `${meta.label} · GPT-Image 2 案例与 Prompt`;
  const seoDesc = `${meta.label} GPT-Image 2 提示词案例 ${list.length} 个。${meta.tagline}。中英双语 Prompt，一键复制就能出图。`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "案例", item: `${SITE.url}/cases` },
      {
        "@type": "ListItem",
        position: 3,
        name: meta.label,
        item: `${SITE.url}/category/${meta.slug}`,
      },
    ],
  };

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: seoTitle,
    description: seoDesc,
    inLanguage: "zh-CN",
    url: `${SITE.url}/category/${meta.slug}`,
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
  };

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDesc}
        path={`/category/${meta.slug}`}
        image={list[0]?.imageUrl}
        jsonLd={[breadcrumbLd, collectionLd]}
      />

      <section className="container-narrow pb-4 pt-10 sm:pt-14">
        <nav aria-label="面包屑" className="text-[12px] text-ink-500">
          <Link to="/" className="hover:text-ink-200">首页</Link>
          <span className="mx-2 text-ink-700">›</span>
          <Link to="/cases" className="hover:text-ink-200">案例</Link>
          <span className="mx-2 text-ink-700">›</span>
          <span className="text-ink-300">{meta.label}</span>
        </nav>

        <p className="eyebrow mt-6">Category</p>
        <h1 className="serif-display mt-2 text-[28px] text-ink-50 sm:text-4xl lg:text-[44px]">
          {meta.label}
          <span className="ml-3 align-middle text-[14px] font-medium tabular-nums text-ink-400 sm:text-[16px]">
            {list.length} 个案例
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-300 sm:text-[15px]">
          {meta.tagline}。默认推荐比例 {meta.defaultRatio}。
        </p>

        {/* Sibling category nav */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/cases"
            className="chip chip-idle"
            aria-label="所有案例"
          >
            全部 {ALL_CASES.length}
          </Link>
          {USER_CATEGORIES.map((c) => {
            const isActive = c.key === meta.key;
            return (
              <Link
                key={c.slug}
                to={`/category/${c.slug}`}
                className={`chip ${isActive ? "chip-active" : "chip-idle"}`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="pt-6">
        <CaseGrid cases={list} favoriteIds={ids} onToggleFavorite={toggle} />
      </div>
    </>
  );
}
