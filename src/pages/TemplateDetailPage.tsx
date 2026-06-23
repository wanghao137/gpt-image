import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTemplateById, templateNeighbors } from "../lib/data";
import { SmartImg } from "../components/SmartImg";
import { ImageLightbox } from "../components/ImageLightbox";
import { SEO, SITE } from "../components/SEO";
import { useCopy } from "../hooks/useCopy";
import { absoluteUrl } from "../lib/seo-url.mjs";
import NotFoundPage from "./NotFoundPage";

/**
 * /template/:id — the detail page for an industrial prompt template.
 *
 * Until this page existed the templates listing rendered 63 cards that could
 * only be expanded in place — there was no way to link to, share, or land on a
 * single template. This page mirrors the /case/:slug pattern so every template
 * has a stable, crawlable URL with full content (description / use-when /
 * prompt / source) rather than just the in-card summary.
 *
 * Layout:
 *   - Desktop: 12-col, image (5) sticky on the left, content (7) on the right.
 *   - Mobile: single column, image first then content.
 *   - Prompt block reuses the same two-zone shape as the case detail page:
 *     a sticky toolbar (chars + copy) over a scrollable body.
 *   - Prev/next nav at the bottom walks the same sorted order as TemplatesPage.
 */
export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = id ? getTemplateById(id) : undefined;
  const { prev, next } = (() => (t ? templateNeighbors(t) : { prev: undefined, next: undefined }))();
  const { state: copyState, copy } = useCopy(1500, {
    successTitle: "模板已复制",
    successDescription: "去 ChatGPT 粘贴并替换占位",
    successAction: {
      label: "打开 ChatGPT",
      href: "https://chat.openai.com/",
    },
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleCopy = useCallback(() => {
    if (t) copy(t.prompt);
  }, [t, copy]);

  if (!t) return <NotFoundPage />;

  const charCount = t.prompt.length;
  const promptLines = t.prompt.split(/\r?\n/).length;

  const sourceLabel =
    t.sourceLabel ||
    (t.sourceType === "derived-case"
      ? "基于合并案例库自动派生"
      : t.sourceType === "manual"
        ? "本项目手动模板"
        : "上游模板库");

  const ogImage = absoluteUrl(SITE.url, t.cover);
  const canonical = `${SITE.url}/template/${t.id}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "模板", item: `${SITE.url}/templates` },
      { "@type": "ListItem", position: 3, name: t.title, item: canonical },
    ],
  };

  const creativeWorkLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: t.title,
    description: t.description,
    inLanguage: "zh-CN",
    image: ogImage,
    url: canonical,
    keywords: t.tags.join(","),
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
  };

  return (
    <>
      <SEO
        title={`${t.title} · GPT-Image 2 模板`}
        description={t.description}
        path={`/template/${t.id}`}
        image={ogImage}
        imageAlt={t.title}
        jsonLd={[breadcrumbLd, creativeWorkLd]}
      />

      <section className="container-narrow pt-8 sm:pt-12">
        {/* Breadcrumb */}
        <nav aria-label="路径" className="mb-6 text-[12.5px] text-ink-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link to="/" className="transition hover:text-ink-200">
                首页
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <Link to="/templates" className="transition hover:text-ink-200">
                模板
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li className="max-w-[60vw] truncate text-ink-300" title={t.title}>
              {t.title}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Image column */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="group relative block w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40 transition hover:border-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70"
                aria-label="查看模板大图"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-ink-850">
                  <SmartImg
                    src={t.cover}
                    alt={t.title}
                    width={800}
                    height={500}
                    widths={[420, 640, 800]}
                    baseWidth={640}
                    sizes="(min-width:1024px) 40vw, 90vw"
                    loading="eager"
                    fetchPriority="high"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-ink-950/70 px-2.5 py-1 text-[10.5px] font-medium tracking-[0.16em] text-ember-200 backdrop-blur">
                    TEMPLATE
                  </span>
                </div>
              </button>
              <p className="mt-2 text-center text-[12px] text-ink-500">点击图片查看大图</p>
            </div>
          </div>

          {/* Content column */}
          <div className="lg:col-span-7">
            <div className="eyebrow">{t.category}</div>
            <h1 className="serif-display mt-2 text-[26px] leading-tight text-ink-50 sm:text-[32px]">
              {t.title}
            </h1>

            {t.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.tags.map((tag) => (
                  <span
                    key={`${t.id}-${tag}`}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-ink-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-4 text-[14px] leading-relaxed text-ink-300 sm:text-[15px]">
              {t.description}
            </p>

            {t.useWhen && (
              <section className="mt-6 rounded-xl border border-white/[0.08] bg-ink-950/40 p-4">
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
                  Use When · 何时使用
                </div>
                <p className="text-[13px] leading-relaxed text-ink-300">{t.useWhen}</p>
              </section>
            )}

            {/* Prompt block */}
            <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-950/50">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
                    Prompt
                  </span>
                  <span className="text-[11.5px] text-ink-500">
                    {charCount} 字符 · {promptLines} 行
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="复制 Prompt"
                  className={
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition " +
                    (copyState === "copied"
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                      : copyState === "error"
                        ? "border-red-400/40 bg-red-400/10 text-red-200"
                        : "border-white/10 bg-white/[0.03] text-ink-100 hover:border-ember-500/40 hover:bg-ember-500/10 hover:text-ember-100")
                  }
                >
                  {copyState === "copied" ? (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path d="m5 12 5 5 9-11" />
                      </svg>
                      已复制
                    </>
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      复制 Prompt
                    </>
                  )}
                </button>
              </div>
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap p-4 font-mono text-[12.5px] leading-relaxed text-ink-200">
                {t.prompt}
              </pre>
            </section>

            {/* Source */}
            <div className="mt-5 flex flex-col gap-2 border-t border-white/[0.06] pt-4 text-[12px] text-ink-400 sm:flex-row sm:items-center sm:justify-between">
              <span>来源：{sourceLabel}</span>
              {t.sourceUrl && (
                <a
                  href={t.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-ember-300 transition hover:text-ember-200"
                >
                  查看数据源
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path d="M15 3h6v6" />
                    <path d="M10 14 21 3" />
                    <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Prev / next nav */}
        {(prev || next) && (
          <nav
            aria-label="模板导航"
            className="mt-12 grid gap-3 border-t border-white/[0.06] pt-6 sm:grid-cols-2"
          >
            {prev ? (
              <Link
                to={`/template/${prev.id}`}
                className="group flex flex-col rounded-xl border border-white/[0.06] bg-ink-900/40 p-4 transition hover:border-white/15"
              >
                <span className="text-[11px] uppercase tracking-[0.16em] text-ink-500">← 上一个</span>
                <span className="mt-1 truncate text-[14px] text-ink-200 transition group-hover:text-ember-200">
                  {prev.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                to={`/template/${next.id}`}
                className="group flex flex-col rounded-xl border border-white/[0.06] bg-ink-900/40 p-4 text-right transition hover:border-white/15"
              >
                <span className="text-[11px] uppercase tracking-[0.16em] text-ink-500">下一个 →</span>
                <span className="mt-1 truncate text-[14px] text-ink-200 transition group-hover:text-ember-200">
                  {next.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}

        <div className="pb-16 pt-8 text-center">
          <Link
            to="/templates"
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-400 transition hover:text-ember-200"
          >
            ← 返回全部模板
          </Link>
        </div>
      </section>

      <ImageLightbox
        open={lightboxOpen}
        src={t.cover}
        alt={t.title}
        caption={t.title}
        ratio="16:10"
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
