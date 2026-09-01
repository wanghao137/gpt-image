import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SEO } from "../components/SEO";
import { SmartImg } from "../components/SmartImg";
import { ImageLightbox } from "../components/ImageLightbox";
import { useCopy } from "../hooks/useCopy";
import { useLabDetail } from "../hooks/useLabDetail";
import { serializeLabHydrationData, LAB_HYDRATION_ELEMENT_ID } from "../hooks/lab-hydration-core.mjs";
import { labOriginalUrl } from "../lib/lab-cos-core.mjs";
import NotFoundPage from "./NotFoundPage";

function labDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function LabDetailLoading() {
  return (
    <section className="container-narrow pb-16 pt-10 sm:pt-14" aria-busy="true" aria-live="polite">
      <p className="eyebrow">4K 实验室</p>
      <div className="mt-6 grid gap-7 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <div className="min-h-[27rem] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.03] sm:min-h-[34rem]" />
        </div>
        <div className="lg:col-span-5">
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-white/[0.05]" />
          <div className="mt-4 h-40 animate-pulse rounded-lg bg-white/[0.03]" />
        </div>
      </div>
    </section>
  );
}

/**
 * /lab/:slug — one 4K original with its full prompt, generation params, an
 * up-to-2160px lightbox, and the untouched original download. The full prompt
 * renders into the SSG'd HTML (SEO long-tail) and hydrates from an embedded
 * JSON blob; SPA navigation fetches lab/prompts/<slug>.json.
 */
export default function LabDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { item, urls, prev, next, loading } = useLabDetail(slug);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { state: copyState, copy } = useCopy();
  const navigate = useNavigate();

  if (!item) {
    if (loading) return <LabDetailLoading />;
    return <NotFoundPage />;
  }

  // Build-time URLs (same-origin baked variants). Defensive R2-original
  // fallbacks in case a shard predates the url map — keeps the page
  // renderable either way.
  const detailSrc = urls?.detail ?? labOriginalUrl(item.cosKey);
  const lightboxSrc = urls?.lightbox ?? detailSrc;
  const ogSrc = urls?.og ?? labOriginalUrl(item.cosKey);
  const origHref = urls?.orig ?? labOriginalUrl(item.cosKey);
  const ratio = `${Math.max(item.width, 1)}:${Math.max(item.height, 1)}`;

  return (
    <>
      <script
        id={LAB_HYDRATION_ELEMENT_ID}
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: serializeLabHydrationData({ item, urls, prev, next }),
        }}
      />
      <SEO
        type="article"
        title={`${item.title} · 4K 实验室`}
        description={item.promptPreview}
        path={`/lab/${item.slug}`}
        image={ogSrc}
        imageAlt={item.title}
      />

      <section className="container-narrow pb-16 pt-7 sm:pt-8">
        {/* breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] text-ink-500">
          <Link to="/lab" className="transition hover:text-ink-200">
            4K 实验室
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink-400">{labDate(item.createdAt)}</span>
        </div>

        <div className="mt-5 grid gap-7 lg:grid-cols-12 lg:gap-10">
          {/* image column */}
          <div className="lg:col-span-7">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="group block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900/50"
              style={{ aspectRatio: `${Math.max(item.width, 1)} / ${Math.max(item.height, 1)}` }}
              aria-label="放大查看"
            >
              <SmartImg
                src={detailSrc}
                alt={item.title}
                width={item.width}
                height={item.height}
                preserveAspectRatio
                fetchPriority="high"
                className="h-full w-full transition duration-300 group-hover:scale-[1.01]"
              />
            </button>
            <a
              href={origHref}
              download
              target="_blank"
              rel="noopener"
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-ember-500/50 bg-ember-500/15 px-4 text-[13px] font-medium text-ember-100 transition hover:border-ember-400/70 hover:bg-ember-500/25"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              下载 4K 原图（PNG）
            </a>
          </div>

          {/* info column */}
          <div className="lg:col-span-5">
            <p className="eyebrow">4K 原生生图</p>
            <h1 className="mt-2 text-[22px] font-semibold leading-snug tracking-[-0.01em] text-ink-50 sm:text-2xl">
              {item.title}
            </h1>

            <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
              {[
                `${item.width}×${item.height}`,
                item.model,
                item.quality ? `quality ${item.quality}` : null,
                labDate(item.createdAt),
              ]
                .filter(Boolean)
                .map((chip) => (
                  <span
                    key={String(chip)}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-ink-300"
                  >
                    {chip}
                  </span>
                ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[13px] font-semibold tracking-wide text-ink-300">完整 Prompt</h2>
                <button
                  type="button"
                  onClick={() => void copy(item.prompt)}
                  className={
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition " +
                    (copyState === "copied"
                      ? "border-ember-500/50 bg-ember-500/15 text-ember-100"
                      : copyState === "error"
                        ? "border-red-400/50 bg-red-400/10 text-red-200"
                        : "border-white/10 bg-white/[0.03] text-ink-200 hover:border-white/25 hover:text-ink-50")
                  }
                >
                  {copyState === "copied" ? "已复制" : copyState === "error" ? "复制失败，请手动选择" : "复制 Prompt"}
                </button>
              </div>
              <pre className="mt-3 max-h-[26rem] overflow-y-auto whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-ink-200 scrollbar-thin">
                {item.prompt}
              </pre>
            </div>
          </div>
        </div>

        {/* prev / next */}
        <nav className="mt-10 grid grid-cols-2 gap-3 text-[13px]" aria-label="相邻生图">
          {prev ? (
            <Link
              to={`/lab/${prev.slug}`}
              className="group rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition hover:border-white/20"
            >
              <span className="text-[11px] text-ink-500">← 较新一张</span>
              <span className="mt-0.5 block truncate font-medium text-ink-300 group-hover:text-ink-50">
                {prev.t}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to={`/lab/${next.slug}`}
              className="group rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-right transition hover:border-white/20"
            >
              <span className="text-[11px] text-ink-500">较旧一张 →</span>
              <span className="mt-0.5 block truncate font-medium text-ink-300 group-hover:text-ink-50">
                {next.t}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </section>

      <ImageLightbox
        open={lightboxOpen}
        src={lightboxSrc}
        alt={item.title}
        caption={item.title}
        ratio={ratio}
        onCopy={() => void copy(item.prompt)}
        copyState={copyState}
        onPrev={
          prev
            ? () => {
                setLightboxOpen(false);
                navigate(`/lab/${prev.slug}`);
              }
            : undefined
        }
        onNext={
          next
            ? () => {
                setLightboxOpen(false);
                navigate(`/lab/${next.slug}`);
              }
            : undefined
        }
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
