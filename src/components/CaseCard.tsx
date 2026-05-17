import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PromptCase } from "../types";
import { useCopy } from "../hooks/useCopy";
import { getCachedPrompt, prefetchPrompt } from "../hooks/usePrompt";
import { tagLabel } from "../lib/labels";
import { userCategoryLabel } from "../lib/userCategories";
import { SmartImg } from "./SmartImg";

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

function tagsOf(data: PromptCase) {
  // Only 2 tags visible by default — keeps the card's footer breathing.
  return Array.from(new Set([...data.styles, ...data.scenes])).slice(0, 2);
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
      className="h-3.5 w-3.5"
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
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}

/**
 * Editorial-grade case card.
 *
 * Design rules:
 *   - Image is the hero. Everything else is in service of it.
 *   - Default state shows nothing on top of the image — no badges, no chips.
 *     The viewer can scan a 4-column grid of pure imagery.
 *   - Hover surfaces ratio + favorite + author + a "View" affordance.
 *   - Footer uses a single horizontal row: title / 2 tags / copy button.
 *     No source line, no category eyebrow — both are reachable via hover or
 *     the detail page.
 *   - Copy button is outline by default; fills with ember on hover. This way
 *     a 4-up grid doesn't have 4 saturated CTAs fighting for attention.
 */
function CaseCardImpl({ data, favorited, onToggleFavorite }: CaseCardProps) {
  const { state, copy } = useCopy();
  const [imgErr, setImgErr] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [copying, setCopying] = useState(false);
  const articleRef = useRef<HTMLElement | null>(null);
  const tags = tagsOf(data);

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

  return (
    <article
      ref={articleRef}
      onMouseEnter={() => prefetchPrompt(data.id)}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-ink-900/40 transition duration-500 hover:border-white/15 hover:shadow-soft"
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
                "absolute inset-0 h-full w-full object-cover transition duration-[900ms] ease-out group-hover:scale-[1.04] " +
                (imgLoaded ? "opacity-100" : "opacity-0")
              }
            />
          )}

          {/* Hover-only gradient frames the image without polluting default state. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950/90 via-ink-950/30 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

          {/* Favorite — always visible on mobile, hover-only on desktop */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(data.id);
            }}
            aria-label={favorited ? "取消收藏" : "收藏"}
            className={
              "absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full border backdrop-blur transition " +
              (favorited
                ? "border-ember-400/60 bg-ember-500/25 text-ember-100"
                : "border-white/15 bg-ink-950/55 text-ink-100 opacity-100 hover:border-ember-400/60 hover:text-ember-200 sm:opacity-0 sm:group-hover:opacity-100")
            }
          >
            <HeartIcon filled={favorited} />
          </button>

          {/* Hover overlay: ratio + author + view affordance */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 opacity-0 transition duration-500 group-hover:opacity-100">
            <div className="min-w-0 flex-1 text-[11px] text-ink-200">
              <span className="rounded-md border border-white/15 bg-ink-950/60 px-1.5 py-0.5 font-mono backdrop-blur">
                {data.ratio}
              </span>
              {data.source && (
                <span className="ml-2 truncate align-middle text-[11px] text-ink-300">
                  {data.source}
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-medium text-ink-50 backdrop-blur">
              查看
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

      <div className="flex items-center gap-2 px-3.5 pb-3 pt-3">
        <div className="min-w-0 flex-1">
          <Link
            to={detailHref}
            className="block text-[13.5px] font-semibold leading-snug text-ink-100 transition group-hover:text-ember-200"
          >
            <span className="line-clamp-1">{data.title}</span>
          </Link>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-500">
            <Link
              to={`/category/${data.userCategory}`}
              className="truncate transition hover:text-ember-200"
              onClick={(e) => e.stopPropagation()}
            >
              {userCategoryLabel(data.userCategory)}
            </Link>
            {tags.length > 0 && <span className="text-ink-700">·</span>}
            {tags.map((tag, i) => (
              <span
                key={`${data.id}-${tag}`}
                className="truncate text-ink-400"
              >
                {tagLabel(tag)}
                {i < tags.length - 1 && <span className="ml-1.5 text-ink-700">·</span>}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCopy();
          }}
          disabled={copying}
          aria-label="复制 Prompt"
          className={
            "inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-semibold transition disabled:opacity-60 " +
            (state === "copied"
              ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
              : state === "error"
                ? "border-rose-400/40 bg-rose-400/15 text-rose-200"
                : "border-white/10 bg-white/[0.03] text-ink-200 hover:border-ember-500/50 hover:bg-ember-500/10 hover:text-ember-100")
          }
        >
          {copying ? (
            <span className="text-[11px]">…</span>
          ) : state === "copied" ? (
            <>
              <CheckIcon />
              <span className="hidden sm:inline">已复制</span>
            </>
          ) : state === "error" ? (
            <span className="text-[11px]">失败</span>
          ) : (
            <>
              <CopyIcon />
              <span className="hidden sm:inline">复制</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
}

export const CaseCard = memo(CaseCardImpl);
