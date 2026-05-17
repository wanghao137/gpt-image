import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PromptCase } from "../types";
import { useCopy } from "../hooks/useCopy";
import { getCachedPrompt, prefetchPrompt } from "../hooks/usePrompt";
import { tagLabel } from "../lib/labels";
import { userCategoryLabel } from "../lib/userCategories";
import { SmartImg } from "./SmartImg";
import { RatioBadge } from "./RatioBadge";

interface CaseCardProps {
  data: PromptCase;
  favorited: boolean;
  onToggleFavorite: (id: string) => void;
}

const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 400'>
       <rect width='320' height='400' fill='#1a1715'/>
       <text x='50%' y='50%' fill='#7a746c' font-family='sans-serif' font-size='12'
             text-anchor='middle' dy='.3em'>image unavailable</text>
     </svg>`,
  );

/** Map a ratio string like "9:16" to a CSS aspect-ratio value. */
function aspectStyle(ratio: string): React.CSSProperties {
  if (!ratio) return { aspectRatio: "4 / 5" };
  const [w, h] = ratio.split(":").map((n) => Number(n.trim()));
  if (!w || !h) return { aspectRatio: "4 / 5" };
  return { aspectRatio: `${w} / ${h}` };
}

function previewText(data: PromptCase, max = 120): string {
  const text = data.promptPreview || "";
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > max ? trimmed.slice(0, max) + "…" : trimmed;
}

function tagsOf(data: PromptCase) {
  return Array.from(new Set([...data.styles, ...data.scenes])).slice(0, 3);
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
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
function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}

function CaseCardImpl({ data, favorited, onToggleFavorite }: CaseCardProps) {
  const { state, copy } = useCopy();
  const [imgErr, setImgErr] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [copying, setCopying] = useState(false);
  const articleRef = useRef<HTMLElement | null>(null);
  const tags = tagsOf(data);

  // Prefetch the full prompt when the card scrolls into view (idle CPU only).
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const trigger = () => prefetchPrompt(data.id);
            const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
              .requestIdleCallback;
            if (typeof idle === "function") idle(trigger);
            else setTimeout(trigger, 200);
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [data.id]);

  const handleSpotlight = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - rect.top}px`);
  }, []);

  const handleCopy = useCallback(async () => {
    const cached = getCachedPrompt(data.id);
    if (cached) {
      copy(cached);
      return;
    }
    setCopying(true);
    try {
      const url = `${import.meta.env.BASE_URL}data/prompts/${data.id}.json`;
      const r = await fetch(url, { cache: "force-cache" });
      const json = (await r.json()) as { prompt: string };
      copy(json.prompt);
    } catch {
      copy("");
    } finally {
      setCopying(false);
    }
  }, [copy, data.id]);

  const detailHref = `/case/${data.slug}`;

  const copyLabel = copying ? (
    <>复制中…</>
  ) : state === "copied" ? (
    <>
      <CheckIcon /> 已复制
    </>
  ) : state === "error" ? (
    <>复制失败</>
  ) : (
    <>
      <CopyIcon /> 复制 Prompt
    </>
  );

  return (
    <article
      ref={articleRef}
      onMouseMove={handleSpotlight}
      onMouseEnter={() => prefetchPrompt(data.id)}
      className="card-spotlight group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/60 backdrop-blur-sm transition duration-500 hover:-translate-y-1 hover:border-white/[0.16] hover:shadow-soft"
    >
      <Link
        to={detailHref}
        className="relative block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500/50"
        aria-label={`查看案例 ${data.title}`}
      >
        <div className="relative overflow-hidden bg-ink-850" style={aspectStyle(data.ratio)}>
          {!imgLoaded && !imgErr && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ink-850 to-ink-800" />
          )}
          {imgErr ? (
            <img
              src={FALLBACK}
              alt={data.imageAlt || data.title}
              width={640}
              height={800}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <SmartImg
              src={data.imageUrl}
              alt={data.imageAlt || data.title}
              width={640}
              height={800}
              widths={[360, 540, 720]}
              baseWidth={540}
              sizes="(min-width:1280px) 280px, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
              onError={() => setImgErr(true)}
              onLoad={() => setImgLoaded(true)}
              className={
                "absolute inset-0 h-full w-full object-cover transition duration-[1200ms] ease-out group-hover:scale-[1.06] " +
                (imgLoaded ? "opacity-100" : "opacity-0")
              }
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink-950/95 via-ink-950/30 to-transparent opacity-60 transition duration-500 group-hover:opacity-90" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-ink-950/50 to-transparent" />

          <span className="absolute left-3 top-3">
            <RatioBadge ratio={data.ratio} />
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(data.id);
            }}
            aria-label={favorited ? "取消收藏" : "收藏"}
            className={
              "absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border backdrop-blur transition " +
              (favorited
                ? "border-ember-400/60 bg-ember-500/20 text-ember-200"
                : "border-white/15 bg-ink-950/60 text-ink-200 opacity-100 hover:border-ember-400/60 hover:text-ember-200 sm:opacity-0 sm:group-hover:opacity-100")
            }
          >
            <HeartIcon filled={favorited} />
          </button>

          <div className="absolute inset-x-0 bottom-0 translate-y-1.5 p-3 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-ink-50 backdrop-blur">
              查看详情
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </div>
      </Link>

      <div className="relative z-[2] flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
          <Link
            to={`/category/${data.userCategory}`}
            className="truncate hover:text-ember-200"
            onClick={(e) => e.stopPropagation()}
          >
            {userCategoryLabel(data.userCategory)}
          </Link>
          {data.source && (
            <span className="truncate text-ink-500" title={data.source}>
              {data.source}
            </span>
          )}
        </div>

        <Link to={detailHref} className="block text-left">
          <h3 className="line-clamp-1 text-[15px] font-semibold leading-snug text-ink-50 transition group-hover:text-ember-200">
            {data.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-400">
            {previewText(data)}
          </p>
        </Link>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={`${data.id}-${tag}`} className="tag">
                {tagLabel(tag)}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopy}
            disabled={copying}
            className={
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition disabled:opacity-60 " +
              (state === "copied"
                ? "bg-emerald-400 text-ink-950"
                : state === "error"
                  ? "bg-rose-400 text-ink-950"
                  : "bg-ember-500 text-ink-950 hover:bg-ember-400")
            }
          >
            {copyLabel}
          </button>
          <Link
            to={detailHref}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-ink-300 transition hover:border-white/25 hover:text-ink-50"
            aria-label="详情"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}

export const CaseCard = memo(CaseCardImpl);
