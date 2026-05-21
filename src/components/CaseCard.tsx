import { memo, useCallback, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { PromptCase } from "../types";
import { useCopy } from "../hooks/useCopy";
import { getCachedPrompt, prefetchPrompt } from "../hooks/usePrompt";
import { useLongPress } from "../hooks/useLongPress";
import { tagLabel } from "../lib/labels";
import { userCategoryLabel } from "../lib/userCategories";
import { pickLocalWebp } from "../lib/img";
import { rememberCaseReturn } from "../lib/caseReturn";
import { SmartImg } from "./SmartImg";
import { CardActionSheet, type CardAction } from "./CardActionSheet";

interface CaseCardProps {
  data: PromptCase;
  favorited: boolean;
  onToggleFavorite: (id: string) => void;
  /**
   * Prioritize this card's image. Used for above-the-fold cards (e.g. the
   * featured grid on the home page) so the browser fetches them eagerly
   * with high priority instead of treating them as lazy below-the-fold.
   */
  priority?: boolean;
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
function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: size, height: size }}
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
function ZoomIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.5 13.5 3 3M9 6.5v5M6.5 9h5" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h3l1.5 1.5h6.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14V6.5Z" />
    </svg>
  );
}

/**
 * Editorial-grade case card.
 *
 * Layout:
 *   - Mobile: image → title (one line) → primary action row (Copy + Favorite).
 *     The category/tag eyebrow that used to live on the card is now reachable
 *     via long-press menu — fewer touch targets fighting for the user's
 *     thumb, and no "I tapped the title but landed on a category" surprises.
 *   - Desktop: same image, but the secondary metadata row (category · tags)
 *     stays visible. Pointer precision is fine, info density is welcome.
 *
 * Gestures:
 *   - Long-press (mobile) / right-click (desktop): opens CardActionSheet
 *     with primary actions: Copy, Open detail, View full image, Favorite,
 *     Browse same category.
 *   - Tap: navigate to detail.
 *   - Tap copy button: copy + global toast (with "去 ChatGPT" action).
 *
 * Performance:
 *   - Prompt prefetch only on fine-pointer hover. Mobile should not burn
 *     bandwidth fetching prompt JSON for every card that scrolls into view.
 *   - `priority` flag controls eager fetch + fetchpriority=high; flip on for
 *     above-the-fold cards only.
 */
function CaseCardImpl({ data, favorited, onToggleFavorite, priority = false }: CaseCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, copy } = useCopy(1500, {
    successTitle: "Prompt 已复制",
    successDescription: "去 ChatGPT 粘贴出图",
    successAction: {
      label: "打开 ChatGPT",
      href: "https://chat.openai.com/",
    },
  });
  const [imgErr, setImgErr] = useState(false);
  const [copying, setCopying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const suppressNextClickRef = useRef(false);
  const tags = tagsOf(data);
  const detailHref = `/case/${data.slug}`;
  const rememberReturn = useCallback(() => {
    rememberCaseReturn(
      data.id,
      `${location.pathname}${location.search}${location.hash}`,
    );
  }, [data.id, location.hash, location.pathname, location.search]);

  // ── Copy handler (shared by inline button + action sheet) ──
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

  // ── Long press / right click → action sheet ──
  const longPress = useLongPress({
    onLongPress: () => {
      suppressNextClickRef.current = true;
      setMenuOpen(true);
    },
  });

  const sheetActions: CardAction[] = [
    {
      key: "copy",
      label: state === "copied" ? "已复制" : "复制 Prompt",
      icon: state === "copied" ? <CheckIcon /> : <CopyIcon size={16} />,
      variant: "accent",
      hint: "粘贴到 ChatGPT 即可出图",
      onSelect: () => {
        void handleCopy();
      },
    },
    {
      key: "detail",
      label: "查看案例详情",
      icon: <ArrowRightIcon />,
      hint: "完整 Prompt + 大图查看",
      onSelect: () => {
        rememberReturn();
        navigate(detailHref);
      },
    },
    {
      key: "lightbox",
      label: "打开大图",
      icon: <ZoomIcon />,
      hint: "进入详情页后双指缩放查看",
      onSelect: () => {
        rememberReturn();
        navigate(detailHref + "?z=1");
      },
    },
    {
      key: "fav",
      label: favorited ? "取消收藏" : "收藏",
      icon: <HeartIcon filled={favorited} />,
      onSelect: () => onToggleFavorite(data.id),
    },
    {
      key: "category",
      label: `更多 ${userCategoryLabel(data.userCategory)}`,
      icon: <FolderIcon />,
      hint: "浏览同类型案例",
      onSelect: () => navigate(`/category/${data.userCategory}`),
    },
  ];

  return (
    <>
      <article
        id={`case-${data.id}`}
        onMouseEnter={() => {
          if (typeof window === "undefined") return;
          if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            prefetchPrompt(data.id);
          }
        }}
        onClickCapture={(e) => {
          if (!suppressNextClickRef.current) return;
          suppressNextClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        {...longPress}
        // Block iOS callout (long-press → "Save Image / Copy Image") so our
        // menu can take over. Without this the OS sheet fights ours.
        style={{ WebkitTouchCallout: "none" }}
        className="case-card group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-ink-900/40 transition duration-500 hover:border-white/15 hover:shadow-soft"
      >
        <Link
          to={detailHref}
          onClick={rememberReturn}
          className="relative block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500/50"
          aria-label={`查看案例 ${data.title}`}
        >
          <div className="relative overflow-hidden bg-ink-850" style={aspectStyle(data.ratio)}>
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
                widths={[280, 420, 560, 800]}
                baseWidth={280}
                sizes="(min-width:1280px) 280px, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "auto"}
                onError={() => setImgErr(true)}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
              />
            )}

            {/* Hover-only gradient frames the image without polluting default state. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950/90 via-ink-950/30 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

            {/* Favorite — always visible on mobile (with stronger contrast),
                hover-only on desktop. */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(data.id);
              }}
              aria-label={favorited ? "取消收藏" : "收藏"}
              className={
                "absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full border backdrop-blur-md transition sm:h-8 sm:w-8 " +
                (favorited
                  ? "border-ember-400/60 bg-ember-500/30 text-ember-100"
                  : "border-white/25 bg-ink-950/65 text-ink-50 opacity-100 hover:border-ember-400/60 hover:text-ember-200 sm:border-white/15 sm:bg-ink-950/55 sm:opacity-0 sm:group-hover:opacity-100")
              }
            >
              <HeartIcon filled={favorited} />
            </button>

            {/* Hover overlay: author + view affordance (desktop) */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden items-end justify-between gap-2 p-3 opacity-0 transition duration-500 group-hover:opacity-100 sm:flex">
              <div className="min-w-0 flex-1 text-[11px] text-ink-200">
                {data.source && (
                  <span className="truncate align-middle text-[11px] text-ink-300">
                    {data.source}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-medium text-ink-50 backdrop-blur">
                查看
                <ArrowRightIcon />
              </span>
            </div>

          </div>
        </Link>

        {/* MOBILE FOOTER — single-line title, author/source row, primary action */}
        <div className="flex flex-col gap-2 px-3 pb-3 pt-2.5 sm:hidden">
          <Link
            to={detailHref}
            onClick={rememberReturn}
            className="block text-[14px] font-semibold leading-snug text-ink-50 transition group-hover:text-ember-200"
          >
            <span className="line-clamp-1">{data.title}</span>
          </Link>
          {data.source && (
            <div className="flex items-center gap-1 text-[11.5px] text-ink-400">
              <SourceDot />
              <span className="truncate">{data.source}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
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
                "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold transition disabled:opacity-60 " +
                (state === "copied"
                  ? "bg-emerald-400/95 text-ink-950"
                  : state === "error"
                    ? "bg-rose-400/90 text-ink-950"
                    : "bg-ember-500/95 text-ink-950 active:bg-ember-400")
              }
            >
              {copying ? (
                "…"
              ) : state === "copied" ? (
                <>
                  <CheckIcon /> 已复制
                </>
              ) : state === "error" ? (
                "失败"
              ) : (
                <>
                  <CopyIcon /> 复制 Prompt
                </>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(true);
              }}
              aria-label="更多操作"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-800/70 bg-ink-900/80 text-ink-200 active:bg-ink-850/80"
            >
              <DotsIcon />
            </button>
          </div>
        </div>

        {/* DESKTOP FOOTER — title + author/category meta + always-on copy button */}
        <div className="hidden items-center gap-2 px-3 pb-3 pt-2.5 sm:flex sm:px-3.5 sm:pt-3">
          <div className="min-w-0 flex-1">
            <Link
              to={detailHref}
              onClick={rememberReturn}
              className="block text-[13.5px] font-semibold leading-snug text-ink-100 transition group-hover:text-ember-200"
            >
              <span className="line-clamp-1">{data.title}</span>
            </Link>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-400">
              {data.source && (
                <>
                  <span className="inline-flex items-center gap-1 truncate text-ink-300">
                    <SourceDot />
                    {data.source}
                  </span>
                  <span className="text-ink-600">·</span>
                </>
              )}
              <Link
                to={`/category/${data.userCategory}`}
                className="truncate transition hover:text-ember-200"
                onClick={(e) => e.stopPropagation()}
              >
                {userCategoryLabel(data.userCategory)}
              </Link>
              {tags.length > 0 && <span className="text-ink-600">·</span>}
              {tags.map((tag, i) => (
                <span key={`${data.id}-${tag}`} className="truncate text-ink-300">
                  {tagLabel(tag)}
                  {i < tags.length - 1 && <span className="ml-1.5 text-ink-600">·</span>}
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
                <span>已复制</span>
              </>
            ) : state === "error" ? (
              <span className="text-[11px]">失败</span>
            ) : (
              <>
                <CopyIcon />
                <span>复制</span>
              </>
            )}
          </button>
        </div>
      </article>

      <CardActionSheet
        open={menuOpen}
        title={data.title}
        caption={userCategoryLabel(data.userCategory)}
        image={pickLocalWebp(data.imageUrl, 168)}
        actions={sheetActions}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}

function DotsIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM13 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
    </svg>
  );
}

/**
 * Tiny dot used as a leader before a `@source` handle. Kept as an icon
 * (not a unicode bullet) so it inherits the surrounding text color and
 * stays crisp at any zoom level.
 */
function SourceDot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1 w-1 shrink-0 rounded-full bg-current opacity-60"
    />
  );
}

export const CaseCard = memo(CaseCardImpl);
