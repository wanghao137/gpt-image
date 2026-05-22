import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";
import { BRAND } from "../lib/brand";
import { ALL_CASES, ALL_TEMPLATES } from "../lib/data";
import { USER_CATEGORIES } from "../lib/userCategories";

const recentCases = ALL_CASES.slice(0, 24);
const visibleCategories = USER_CATEGORIES.filter((item) =>
  ALL_CASES.some(
    (caseItem) =>
      caseItem.userCategory === item.slug ||
      (caseItem.userCategories ?? []).includes(item.slug as never),
  ),
);

export default function SitemapPage() {
  return (
    <>
      <SEO
        title={`站点地图 - ${BRAND.name}`}
        description={`${BRAND.name}的主要页面、场景分类、案例入口与模板入口。`}
        path="/sitemap"
      />

      <section className="container-narrow pt-10 sm:pt-14">
        <p className="eyebrow">Sitemap</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="serif-display text-[30px] leading-tight text-ink-50 sm:text-4xl lg:text-[44px]">
              站点地图
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-300 sm:text-[15px]">
              这里是给用户看的导航入口；搜索引擎使用的 XML 索引仍保留在{" "}
              <a className="text-ember-300 hover:text-ember-200" href="/sitemap.xml">
                /sitemap.xml
              </a>
              。
            </p>
          </div>
          <Link to="/cases" className="btn-primary w-fit">
            浏览全部案例
          </Link>
        </div>
      </section>

      <section className="container-narrow grid gap-5 py-8 sm:py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <SitemapGroup title="核心页面">
          <SitemapLink to="/" label="首页" detail="最新案例、精选模板与场景入口" />
          <SitemapLink to="/cases" label="全部案例" detail={`${ALL_CASES.length} 个案例`} />
          <SitemapLink to="/templates" label="模板库" detail={`${ALL_TEMPLATES.length} 套模板`} />
          <SitemapLink to="/about" label="关于" detail="项目说明与数据来源" />
        </SitemapGroup>

        <SitemapGroup title="场景分类">
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleCategories.map((item) => (
              <SitemapLink
                key={item.slug}
                to={`/category/${item.slug}`}
                label={item.label}
                detail={`${categoryCount(item.slug)} 个案例`}
              />
            ))}
          </div>
        </SitemapGroup>
      </section>

      <section className="container-narrow grid gap-5 pb-16 lg:grid-cols-[1.1fr_0.9fr]">
        <SitemapGroup title="近期案例">
          <div className="grid gap-2 sm:grid-cols-2">
            {recentCases.map((item) => (
              <SitemapLink key={item.id} to={`/case/${item.slug}`} label={item.title} detail={item.ratio} />
            ))}
          </div>
        </SitemapGroup>

        <SitemapGroup title="模板入口">
          {ALL_TEMPLATES.slice(0, 12).map((item) => (
            <SitemapLink key={item.id} to="/templates" label={item.title} detail={item.category} />
          ))}
        </SitemapGroup>
      </section>
    </>
  );
}

function categoryCount(slug: string) {
  return ALL_CASES.filter(
    (item) => item.userCategory === slug || (item.userCategories ?? []).includes(slug as never),
  ).length;
}

function SitemapGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="surface p-5 sm:p-6">
      <h2 className="serif-display text-[22px] text-ink-50">{title}</h2>
      <div className="mt-4 flex flex-col gap-2">{children}</div>
    </article>
  );
}

function SitemapLink({ to, label, detail }: { to: string; label: string; detail: string }) {
  return (
    <Link
      to={to}
      className="group flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5 transition hover:border-ember-500/35 hover:bg-white/[0.04]"
    >
      <span className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink-100 group-hover:text-ink-50">
        {label}
      </span>
      <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-ink-400">
        {detail}
      </span>
    </Link>
  );
}
