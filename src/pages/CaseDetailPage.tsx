import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  caseNeighbors,
  getCaseBySlug,
  relatedCases,
} from "../lib/data";
import {
  getUserCategoryByKey,
  platformLabel,
  userCategoryLabel,
} from "../lib/userCategories";
import { SmartImg } from "../components/SmartImg";
import { CaseGrid } from "../components/CaseGrid";
import { SEO, SITE } from "../components/SEO";
import { WeChatCTA } from "../components/WeChatCTA";
import { RatioBadge } from "../components/RatioBadge";
import { useCopy } from "../hooks/useCopy";
import { useFavorites } from "../hooks/useFavorites";
import { usePrompt } from "../hooks/usePrompt";
import { tagLabel } from "../lib/labels";
import { optimizeImage } from "../lib/img";
import NotFoundPage from "./NotFoundPage";

/**
 * /case/:slug — the page that earns long-tail SEO traffic and converts.
 *
 *   Left  : un-cropped image (object-contain) — preserves real aspect ratio.
 *   Right : title, meta chips, prompt (tab CN/EN), neighbor nav, CTA.
 *   Below : "想要这个风格定制" WeChat CTA → /services.
 *   Below : 6 related cases in same userCategory.
 *
 * Pre-rendered into one HTML file per slug at build time. Each gets its own
 * <title>/<meta description>/<og:image>/JSON-LD so search engines can index.
 */
export default function CaseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const c = slug ? getCaseBySlug(slug) : undefined;
  const { has, toggle } = useFavorites();
  const fetched = usePrompt(c?.id ?? null);
  const { state: copyState, copy } = useCopy();
  const [tab, setTab] = useState<"cn" | "en">("cn");

  const meta = c ? getUserCategoryByKey(c.userCategory) : undefined;
  const related = useMemo(() => (c ? relatedCases(c, 6) : []), [c]);
  const { prev, next } = useMemo(() => (c ? caseNeighbors(c) : { prev: undefined, next: undefined }), [c]);

  if (!c) return <NotFoundPage />;

  // Heuristic: detect whether the loaded prompt is CN or EN (used as default tab).
  const promptText = fetched.prompt;
  const isMostlyChinese =
    promptText && (promptText.match(/[\u4e00-\u9fa5]/g)?.length ?? 0) > promptText.length * 0.2;
  const renderText = tab === "cn" && isMostlyChinese ? promptText : promptText;

  const tags = Array.from(new Set([...c.styles, ...c.scenes, ...c.tags])).slice(0, 8);

  const ogImage = optimizeImage(c.imageUrl, { width: 1200 });

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "案例", item: `${SITE.url}/cases` },
      meta && {
        "@type": "ListItem",
        position: 3,
        name: meta.label,
        item: `${SITE.url}/category/${meta.slug}`,
      },
      {
        "@type": "ListItem",
        position: meta ? 4 : 3,
        name: c.title,
        item: `${SITE.url}/case/${c.slug}`,
      },
    ].filter(Boolean),
  };

  const creativeWorkLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: c.title,
    description: c.seoDescription,
    inLanguage: "zh-CN",
    image: c.imageUrl,
    url: `${SITE.url}/case/${c.slug}`,
    keywords: [...c.tags, ...c.styles, ...c.scenes].join(","),
    dateCreated: c.createdAt,
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
    isBasedOn: c.githubUrl,
    creator: c.source ? { "@type": "Person", name: c.source } : undefined,
  };

  const imageLd = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    contentUrl: c.imageUrl,
    name: c.title,
    description: c.imageAlt || c.title,
    width: "1200",
    height: "1500",
    representativeOfPage: true,
    inLanguage: "zh-CN",
  };

  const favorited = has(c.id);

  return (
    <>
      <SEO
        title={c.seoTitle}
        description={c.seoDescription}
        path={`/case/${c.slug}`}
        image={ogImage}
        imageAlt={c.imageAlt || c.title}
        jsonLd={[breadcrumbLd, creativeWorkLd, imageLd]}
      />

      {/* Breadcrumb */}
      <nav aria-label="面包屑" className="container-narrow pt-8 text-[12px] text-ink-500">
        <Link to="/" className="hover:text-ink-200">首页</Link>
        <span className="mx-2 text-ink-700">›</span>
        <Link to="/cases" className="hover:text-ink-200">案例</Link>
        {meta && (
          <>
            <span className="mx-2 text-ink-700">›</span>
            <Link to={`/category/${meta.slug}`} className="hover:text-ink-200">
              {meta.label}
            </Link>
          </>
        )}
      </nav>

      <article className="container-narrow grid gap-8 pb-12 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-10">
        {/* IMAGE side — preserves true ratio with object-contain */}
        <div className="surface relative overflow-hidden">
          <div
            className="relative grid w-full place-items-center bg-ink-950"
            style={{ minHeight: "60vh" }}
          >
            <SmartImg
              src={c.imageUrl}
              alt={c.imageAlt || c.title}
              width={1200}
              height={1500}
              widths={[720, 1080, 1440]}
              baseWidth={1080}
              sizes="(min-width:1024px) 56vw, 100vw"
              loading="eager"
              fetchPriority="high"
              quality={85}
              className="max-h-[80vh] w-auto max-w-full object-contain"
            />
            <div className="pointer-events-none absolute left-3 top-3">
              <RatioBadge ratio={c.ratio} />
            </div>
            {c.source && (
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/10 bg-ink-950/70 px-2.5 py-1 text-[11px] text-ink-300 backdrop-blur">
                来源 · {c.source}
              </div>
            )}
          </div>
        </div>

        {/* INFO side */}
        <div className="flex flex-col">
          <p className="eyebrow">{meta?.label ?? userCategoryLabel(c.userCategory)}</p>
          <h1 className="serif-display mt-2 text-[28px] leading-[1.1] text-ink-50 sm:text-4xl lg:text-[44px]">
            {c.title}
          </h1>

          {/* Meta chips */}
          <div className="mt-5 flex flex-wrap gap-1.5">
            <Chip label={`📐 ${c.ratio}`} />
            <Chip label={`⚙️ GPT-Image 2`} />
            <Chip label={`📊 难度 ${c.difficulty}/5`} />
            {c.platforms.map((p) => (
              <Chip key={p} label={`📱 ${platformLabel(p)}`} />
            ))}
            <Chip
              label={
                c.commercialOk === "commercial"
                  ? "✅ 可商用"
                  : c.commercialOk === "personal"
                    ? "👤 仅个人"
                    : "💬 商用咨询"
              }
              variant={c.commercialOk === "commercial" ? "ember" : "muted"}
            />
          </div>

          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="tag">
                  {tagLabel(t)}
                </span>
              ))}
            </div>
          )}

          {/* Prompt */}
          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-300">
                Prompt
              </h2>
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setTab("cn")}
                  className={
                    "rounded-full px-2.5 py-1 transition " +
                    (tab === "cn" ? "bg-white/10 text-ink-50" : "text-ink-400 hover:text-ink-100")
                  }
                >
                  中文
                </button>
                <button
                  type="button"
                  onClick={() => setTab("en")}
                  className={
                    "rounded-full px-2.5 py-1 transition " +
                    (tab === "en" ? "bg-white/10 text-ink-50" : "text-ink-400 hover:text-ink-100")
                  }
                >
                  English
                </button>
              </div>
            </div>

            <div className="surface relative">
              <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-2xl p-4 font-mono text-[13px] leading-relaxed text-ink-100 scrollbar-thin sm:p-5">
                {fetched.loading
                  ? "正在加载完整 Prompt…"
                  : renderText || c.promptPreview || "—"}
              </pre>
              {fetched.error && (
                <p className="border-t border-white/[0.06] px-5 py-2 text-[12px] text-rose-300">
                  Prompt 加载失败：{fetched.error}
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={fetched.loading || !renderText}
                onClick={() => copy(renderText || c.promptPreview || "")}
                className={
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition disabled:opacity-50 " +
                  (copyState === "copied"
                    ? "bg-emerald-400 text-ink-950"
                    : copyState === "error"
                      ? "bg-rose-400 text-ink-950"
                      : "bg-ember-500 text-ink-950 hover:bg-ember-400")
                }
              >
                {copyState === "copied" ? "✓ 已复制" : copyState === "error" ? "复制失败" : "复制 Prompt"}
              </button>
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition " +
                  (favorited
                    ? "border-ember-500/50 bg-ember-500/15 text-ember-100"
                    : "border-white/10 bg-white/[0.04] text-ink-200 hover:border-ember-500/40 hover:text-ember-100")
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill={favorited ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
                </svg>
                {favorited ? "已收藏" : "收藏"}
              </button>
              {c.githubUrl && (
                <a
                  href={c.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-ink-300 transition hover:text-ink-50"
                >
                  GitHub 原文
                </a>
              )}
            </div>
          </div>

          {/* Inline WeChat conversion */}
          <div className="mt-8">
            <WeChatCTA context={c.title} variant="compact" />
          </div>

          {/* Prev / Next */}
          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-6">
            {prev ? (
              <Link
                to={`/case/${prev.slug}`}
                className="surface surface-hover flex flex-col gap-1 p-4 text-left"
              >
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">
                  ← 上一个
                </span>
                <span className="line-clamp-1 text-[13px] font-medium text-ink-100">
                  {prev.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                to={`/case/${next.slug}`}
                className="surface surface-hover flex flex-col gap-1 p-4 text-right"
              >
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">
                  下一个 →
                </span>
                <span className="line-clamp-1 text-[13px] font-medium text-ink-100">
                  {next.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      </article>

      {/* RELATED */}
      {related.length > 0 && (
        <section className="container-narrow pb-12 pt-6 sm:pt-10">
          <h2 className="serif-display text-2xl text-ink-50 sm:text-3xl">相关案例</h2>
          <p className="mt-1 text-[13px] text-ink-400">
            同分类、同标签的更多 GPT-Image 2 案例
          </p>
          <div className="mt-6">
            <CaseGrid
              cases={related}
              favoriteIds={new Set()}
              onToggleFavorite={toggle}
              paginate={false}
            />
          </div>
        </section>
      )}

      <WeChatCTA />
    </>
  );
}

function Chip({
  label,
  variant = "muted",
}: {
  label: string;
  variant?: "muted" | "ember";
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium " +
        (variant === "ember"
          ? "border-ember-500/40 bg-ember-500/10 text-ember-100"
          : "border-white/10 bg-white/[0.03] text-ink-200")
      }
    >
      {label}
    </span>
  );
}
