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
import { StickyMobileActions } from "../components/StickyMobileActions";
import { useCopy } from "../hooks/useCopy";
import { useFavorites } from "../hooks/useFavorites";
import { usePrompt } from "../hooks/usePrompt";
import { tagLabel } from "../lib/labels";
import { optimizeImage } from "../lib/img";
import NotFoundPage from "./NotFoundPage";

/** Map "9:16" → CSS aspectRatio. */
function ratioStyle(ratio: string): React.CSSProperties {
  if (!ratio) return { aspectRatio: "4 / 5" };
  const [w, h] = ratio.split(":").map((n) => Number(n.trim()));
  if (!w || !h) return { aspectRatio: "4 / 5" };
  return { aspectRatio: `${w} / ${h}` };
}

/**
 * /case/:slug — long-tail SEO + conversion page.
 *
 * Layout choices:
 *   - 12-col on desktop: image takes 7 cols sticky, info takes 5 cols.
 *   - Image renders at its real aspect ratio (no forced 60vh black box) so
 *     no padding bars appear on either side; container shrinks to fit.
 *   - Prompt block is two-zone: sticky toolbar (tab + chars + copy) over a
 *     scrollable body. Toolbar tells the user exactly what they're looking
 *     at; body keeps the long prompt inside its own scroller without bloating
 *     the page.
 *   - Three CTAs are layered, never side-by-side: ember "copy" inside prompt
 *     toolbar, ghost "favorite + github" below, then the WeChat compact CTA
 *     in its own surface, then the prev/next nav.
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
  const { prev, next } = useMemo(
    () => (c ? caseNeighbors(c) : { prev: undefined, next: undefined }),
    [c],
  );

  if (!c) return <NotFoundPage />;

  // Same prompt for both tabs until we ship a separate EN prompt field.
  const promptText = fetched.prompt || c.promptPreview || "";
  const charCount = promptText.length;
  const wordCount = promptText.trim().split(/\s+/).filter(Boolean).length;

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

      {/* Breadcrumb + author */}
      <div className="container-narrow flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-8 text-[12px] text-ink-500">
        <nav aria-label="面包屑" className="flex items-center gap-1.5">
          <Link to="/" className="hover:text-ink-200">首页</Link>
          <span className="text-ink-700">›</span>
          <Link to="/cases" className="hover:text-ink-200">案例</Link>
          {meta && (
            <>
              <span className="text-ink-700">›</span>
              <Link to={`/category/${meta.slug}`} className="hover:text-ink-200">
                {meta.label}
              </Link>
            </>
          )}
        </nav>
        {c.source && (
          <>
            <span className="text-ink-700">·</span>
            <span className="text-ink-400">
              来源 <span className="text-ink-200">{c.source}</span>
            </span>
          </>
        )}
      </div>

      <article className="container-narrow grid gap-7 pb-12 pt-5 lg:grid-cols-12 lg:gap-10">
        {/* IMAGE side — sticky on desktop, true ratio (no black bars). */}
        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-20">
            <figure
              className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/40"
              style={ratioStyle(c.ratio)}
            >
              <SmartImg
                src={c.imageUrl}
                alt={c.imageAlt || c.title}
                width={1200}
                height={1500}
                widths={[720, 1080, 1440]}
                baseWidth={1080}
                sizes="(min-width:1024px) 60vw, 100vw"
                loading="eager"
                fetchPriority="high"
                quality={85}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {/* subtle gradient at bottom for the ratio chip */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink-950/60 to-transparent" />
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-ink-950/65 px-2.5 py-1 text-[11px] font-medium text-ink-100 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-ember-400" />
                {c.ratio} · GPT-Image 2
              </div>
            </figure>

            {/* Quick stats strip below the image — fills the dead space that
                used to be the empty black padding. */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11.5px]">
              <Stat label="比例" value={c.ratio} />
              <Stat label="难度" value={`${c.difficulty} / 5`} />
              <Stat
                label="可商用"
                value={
                  c.commercialOk === "commercial"
                    ? "✓ 是"
                    : c.commercialOk === "personal"
                      ? "仅个人"
                      : "咨询"
                }
                accent={c.commercialOk === "commercial"}
              />
            </div>
          </div>
        </div>

        {/* INFO side */}
        <div className="flex flex-col lg:col-span-5">
          <p className="eyebrow">{meta?.label ?? userCategoryLabel(c.userCategory)}</p>
          <h1 className="serif-display mt-2 text-[28px] leading-[1.1] text-ink-50 sm:text-4xl lg:text-[40px]">
            {c.title}
          </h1>

          {/* Meta chips: scenarios + platforms only — ratio/difficulty already in stat strip */}
          <div className="mt-5 flex flex-wrap gap-1.5">
            {c.platforms.map((p) => (
              <Chip key={p} label={platformLabel(p)} />
            ))}
            {tags.slice(0, 5).map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-0.5 text-[11.5px] font-medium text-ink-300"
              >
                {tagLabel(t)}
              </span>
            ))}
          </div>

          {/* Prompt block — toolbar over scroller. */}
          <section aria-label="Prompt" className="mt-7">
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-950/60">
              {/* Toolbar */}
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-300">
                    Prompt
                  </h2>
                  <div className="inline-flex rounded-full border border-white/10 bg-ink-950/40 p-0.5 text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setTab("cn")}
                      className={
                        "rounded-full px-2.5 py-0.5 transition " +
                        (tab === "cn"
                          ? "bg-white/10 text-ink-50"
                          : "text-ink-400 hover:text-ink-100")
                      }
                    >
                      中文
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("en")}
                      className={
                        "rounded-full px-2.5 py-0.5 transition " +
                        (tab === "en"
                          ? "bg-white/10 text-ink-50"
                          : "text-ink-400 hover:text-ink-100")
                      }
                    >
                      English
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!fetched.loading && promptText && (
                    <span className="hidden text-[11px] tabular-nums text-ink-500 sm:inline">
                      {charCount} 字符 · {wordCount} 词
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={fetched.loading || !promptText}
                    onClick={() => copy(promptText)}
                    className={
                      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition disabled:opacity-50 " +
                      (copyState === "copied"
                        ? "bg-emerald-400 text-ink-950"
                        : copyState === "error"
                          ? "bg-rose-400 text-ink-950"
                          : "bg-ember-500 text-ink-950 hover:bg-ember-400")
                    }
                  >
                    {copyState === "copied" ? (
                      "✓ 已复制"
                    ) : copyState === "error" ? (
                      "失败"
                    ) : (
                      <>
                        <CopyIcon /> 复制
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Scroller */}
              <div className="relative">
                <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap p-4 font-mono text-[13px] leading-relaxed text-ink-100 scrollbar-thin sm:p-5">
                  {fetched.loading
                    ? "正在加载完整 Prompt…"
                    : promptText || "—"}
                </pre>
                {/* Soft fade at the bottom so users notice the scroll */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-ink-950/70 to-transparent"
                />
              </div>

              {fetched.error && (
                <p className="border-t border-white/[0.06] bg-rose-500/5 px-4 py-2 text-[12px] text-rose-300">
                  Prompt 加载失败：{fetched.error}
                </p>
              )}
            </div>

            {/* Secondary actions: favorite + github + char count on mobile */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition " +
                    (favorited
                      ? "border-ember-500/50 bg-ember-500/15 text-ember-100"
                      : "border-white/10 bg-white/[0.04] text-ink-300 hover:border-white/25 hover:text-ink-100")
                  }
                >
                  <HeartIcon filled={favorited} />
                  {favorited ? "已收藏" : "收藏"}
                </button>
                {c.githubUrl && (
                  <a
                    href={c.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="GitHub 原文"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] font-medium text-ink-300 transition hover:border-white/25 hover:text-ink-100"
                  >
                    <GhIcon /> 原文
                  </a>
                )}
              </div>
              {!fetched.loading && promptText && (
                <span className="text-[11px] tabular-nums text-ink-500 sm:hidden">
                  {charCount} 字符
                </span>
              )}
            </div>
          </section>

          {/* WeChat conversion */}
          <div className="mt-8">
            <WeChatCTA context={c.title} variant="compact" />
          </div>

          {/* Prev / Next — image thumbs make these meaningful */}
          {(prev || next) && (
            <div className="mt-8 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-6">
              <NavCard direction="prev" target={prev} />
              <NavCard direction="next" target={next} />
            </div>
          )}
        </div>
      </article>

      {/* RELATED */}
      {related.length > 0 && (
        <section className="container-narrow border-t border-white/[0.05] pb-12 pt-12 sm:pt-16">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Related</p>
              <h2 className="serif-display mt-1 text-2xl text-ink-50 sm:text-3xl">
                同类型的 {related.length} 个案例
              </h2>
            </div>
            {meta && (
              <Link
                to={`/category/${meta.slug}`}
                className="text-[13px] font-medium text-ember-300 transition hover:text-ember-200"
              >
                {meta.label} 全部 →
              </Link>
            )}
          </div>
          <CaseGrid
            cases={related}
            favoriteIds={new Set()}
            onToggleFavorite={toggle}
            paginate={false}
          />
        </section>
      )}

      <WeChatCTA />

      <StickyMobileActions
        onCopy={() => copy(promptText)}
        copyState={copyState}
      />
    </>
  );
}

// ─────────────────────────────────────────── small atoms ──

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border px-3 py-2.5 " +
        (accent
          ? "border-ember-500/30 bg-ember-500/[0.06]"
          : "border-white/[0.06] bg-white/[0.02]")
      }
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-500">
        {label}
      </p>
      <p
        className={
          "mt-0.5 text-[14px] font-semibold tabular-nums " +
          (accent ? "text-ember-100" : "text-ink-100")
        }
      >
        {value}
      </p>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] font-medium text-ink-200">
      {label}
    </span>
  );
}

function NavCard({
  direction,
  target,
}: {
  direction: "prev" | "next";
  target?: { slug: string; title: string; imageUrl: string; userCategory: string } | undefined;
}) {
  if (!target) {
    return (
      <span
        aria-hidden="true"
        className={
          "rounded-2xl border border-dashed border-white/[0.06] p-4 text-[12px] text-ink-600 " +
          (direction === "prev" ? "text-left" : "text-right")
        }
      >
        {direction === "prev" ? "已是第一个" : "已是最后一个"}
      </span>
    );
  }
  const isPrev = direction === "prev";
  return (
    <Link
      to={`/case/${target.slug}`}
      className={
        "group flex items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2 transition hover:border-white/[0.16] hover:bg-white/[0.04] " +
        (isPrev ? "flex-row" : "flex-row-reverse text-right")
      }
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-850">
        <img
          src={optimizeImage(target.imageUrl, { width: 160 })}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
          {isPrev ? "← 上一个" : "下一个 →"}
        </span>
        <strong className="mt-0.5 line-clamp-1 block text-[13px] font-semibold text-ink-100 transition group-hover:text-ember-200">
          {target.title}
        </strong>
        <span className="line-clamp-1 text-[11px] text-ink-500">
          {userCategoryLabel(target.userCategory)}
        </span>
      </div>
    </Link>
  );
}

function CopyIcon() {
  return (
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
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
    </svg>
  );
}

function GhIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.36-3.37-1.36-.46-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.13-4.55-5.04 0-1.11.39-2.02 1.03-2.74-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.42 9.42 0 0 1 12 7.07c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.74 0 3.92-2.34 4.78-4.57 5.03.36.32.68.94.68 1.9v2.81c0 .27.18.6.69.49A10.06 10.06 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
