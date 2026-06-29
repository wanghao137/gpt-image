import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";
import { BRAND } from "../lib/brand";
import { USER_CATEGORIES } from "../lib/userCategories";

export default function NotFoundPage() {
  // A small curated subset of high-traffic categories, so the 404 page is a
  //分流口 into real content rather than a dead end. Sourced from the single
  // source of truth so a slug rename can never 404 the chip row.
  const hotCategories = USER_CATEGORIES.filter((c) => c.pinnedHomepage).slice(0, 6);

  return (
    <>
      <SEO
        title={`页面不存在 · ${BRAND.name}`}
        description="你访问的页面不存在或已下架。回到首页继续浏览 450+ 个 GPT-Image 2 案例。"
        path="/404"
        noindex
      />
      <section className="container-narrow grid place-items-center py-24 text-center">
        <p className="eyebrow">404</p>
        <h1 className="serif-display mt-3 text-[32px] text-ink-50 sm:text-5xl">
          这里没有你找的页面。
        </h1>
        <p className="mt-3 max-w-md text-[14px] text-ink-400">
          也许是链接过时了。回到首页或案例库继续浏览。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn-primary">
            回首页
          </Link>
          <Link to="/cases" className="btn-ghost">
            浏览案例
          </Link>
        </div>

        {/* Hot categories — turn the 404 into a discovery entry point. */}
        <div className="mt-12 w-full max-w-xl">
          <p className="mb-4 text-[12px] font-medium uppercase tracking-wider text-ink-500">
            热门分类
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {hotCategories.map((c) => (
              <Link
                key={c.slug}
                to={`/category/${c.slug}`}
                className="chip chip-idle"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
