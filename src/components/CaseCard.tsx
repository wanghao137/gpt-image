import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { PromptCase } from "../types";
import { useCopy } from "../hooks/useCopy";
import { getCachedPrompt, loadPrompt, prefetchPrompt } from "../hooks/usePrompt";
import { toast } from "../hooks/useToast";
import { useLongPress } from "../hooks/useLongPress";
import { tagLabel, accessibleCaseLabel } from "../lib/labels";
import { userCategoryLabel } from "../lib/userCategories";
import { pickLocalWebp, transformUrl } from "../lib/img";
import { rememberCaseReturn } from "../lib/caseReturn";
import { sourceDisplayLabel } from "../lib/source-label.mjs";
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
  onImageLoad?: () => void;
  /**
   * Same-series siblings (excludes `data`). When non-empty, the card renders
   * as a carousel: arrow + dot navigation switch the active image, and the
   * footer copy (title / source / prompt preview / copy button) follows the
   * active slide. Tap on the image still routes to that slide's detail page.
   */
  siblings?: PromptCase[];
  /**
   * Per-case favorite lookup. When provided, the heart button reflects the
   * active slide's state (so switching within a series shows the right icon).
   * When omitted, falls back to `favorited` for the lead.
   */
  favoritedIds?: Set<string>;
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

/** Reserve the declared shape until the real image dimensions are decoded. */
function ratioDimensions(ratio: string): { width: number; height: number } {
  if (!ratio) return { width: 800, height: 1000 };
  const [w, h] = ratio.split(":").map((n) => Number(n.trim()));
  if (!w || !h) return { width: 800, height: 1000 };
  return { width: 800, height: Math.max(1, Math.round((800 * h) / w)) };
}

function tagsOf(data: PromptCase) {
  // Only 2 tags visible by default — keeps the card's footer breathing.
  // Arrays may be absent (omitted from lite data when empty).
  return Array.from(new Set([...(data.styles ?? []), ...(data.scenes ?? [])])).slice(0, 2);
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
 *   - Mobile: controlled preview image with title/source/actions overlaid at
 *     the bottom, so identity + Copy Prompt are visible before the user scrolls
 *     through the full image height. Full uncropped media remains in detail.
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
function CaseCardImpl({
  data,
  favorited,
  onToggleFavorite,
  priority = false,
  onImageLoad,
  siblings,
  favoritedIds,
}: CaseCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // ── Carousel state ──
  // Two sources of "more images" collapse into one flat slide list:
  //   1. Multi-image upstream cases — `imageUrls[]` are additional outputs
  //      of the SAME prompt. Switching between them keeps title / prompt /
  //      detail-page link unchanged.
  //   2. Series siblings — `siblings[]` are OTHER cases that share a manual
  //      or auto `seriesId`. Switching between them updates the whole footer.
  // Each slide records which case it belongs to + which image index inside
  // that case, so the footer copy can follow the active case while the
  // SmartImg src follows the active image.
  type Slide = { caseId: string; imgIdx: number; url: string; alt: string };
  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    const seenCaseIds = new Set<string>();
    const pushCase = (c: PromptCase) => {
      if (!c || seenCaseIds.has(c.id)) return;
      seenCaseIds.add(c.id);
      const alt = c.imageAlt || c.title;
      out.push({ caseId: c.id, imgIdx: 0, url: c.imageUrl, alt });
      // imageUrls are the EXTRA images (imageUrl is already index 0 above).
      (c.imageUrls ?? []).forEach((u, i) => {
        if (typeof u === "string" && u) out.push({ caseId: c.id, imgIdx: i + 1, url: u, alt });
      });
    };
    pushCase(data);
    for (const s of siblings ?? []) pushCase(s);
    return out;
  }, [data, siblings]);
  const hasMultiple = slides.length > 1;
  const [activeIdx, setActiveIdx] = useState(0);
  // Clamp activeIdx if slides shrink (e.g. after filter change upstream).
  const safeActiveIdx = Math.min(activeIdx, slides.length - 1);
  const activeSlide = slides[safeActiveIdx] ?? slides[0] ?? { caseId: data.id, imgIdx: 0, url: data.imageUrl, alt: data.imageAlt || data.title };
  // Look up the active case from the slide. Falls back to `data` if the slide
  // case isn't in our local set (defensive — shouldn't happen).
  const caseById = useMemo(() => {
    const m = new Map<string, PromptCase>();
    m.set(data.id, data);
    for (const s of siblings ?? []) if (s) m.set(s.id, s);
    return m;
  }, [data, siblings]);
  const activeCase = caseById.get(activeSlide.caseId) ?? data;
  const isSeriesActive = activeCase.id !== data.id;

  const sourceLabel = sourceDisplayLabel(activeCase.source, activeCase.githubUrl);
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const suppressNextClickRef = useRef(false);

  // Per-slide favorite lookup — prefers the explicit set when the parent
  // provides one (so switching within a series reflects the right heart).
  // Falls back to the lead `favorited` prop when looking at the lead, and
  // treats non-lead siblings as unfavored by default.
  const activeFavorited = favoritedIds
    ? favoritedIds.has(activeCase.id)
    : favorited && !isSeriesActive;

  // Reset transient image state when the active slide changes (covers both
  // multi-image switches inside one case and series jumps between cases).
  // Preview panel reset only on cross-case jumps (the prompt text changes).
  const activeSlideKey = `${activeSlide.caseId}:${activeSlide.imgIdx}`;
  const prevSlideCaseRef = useRef(activeSlide.caseId);
  useEffect(() => {
    if (prevSlideCaseRef.current !== activeSlide.caseId) {
      // Cross-case series jump — clear stale preview + image error.
      setImgErr(false);
      setPreviewOpen(false);
      prevSlideCaseRef.current = activeSlide.caseId;
    } else {
      // Same case, different image — just clear any stale error.
      setImgErr(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlideKey]);

  const setActiveIdxSafe = useCallback(
    (next: number) => {
      setActiveIdx(((next % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  // ── Horizontal swipe within a series card ──
  // Records the pointer down position and, on pointer up, switches the
  // active slide when the horizontal travel exceeds ~40px AND beats the
  // vertical travel (so a scroll gesture never hijacks the carousel).
  // Swipe also suppresses the next click on the image Link so a switch
  // never routes the user into the detail page mid-gesture.
  const swipeStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!hasMultiple) return;
    if (e.pointerType === "mouse") return; // mice use the arrows
    swipeStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, [hasMultiple]);
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!hasMultiple) return;
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return;
    // Treat as a swipe — block the subsequent click on the image Link.
    suppressNextClickRef.current = true;
    setActiveIdxSafe(dx < 0 ? safeActiveIdx + 1 : safeActiveIdx - 1);
  }, [hasMultiple, safeActiveIdx, setActiveIdxSafe]);

  const tags = tagsOf(activeCase);
  const detailHref = `/case/${activeCase.slug}`;
  const imageDimensions = ratioDimensions(activeCase.imageRatio || activeCase.ratio);

  const rememberReturn = useCallback(() => {
    rememberCaseReturn(
      activeCase.id,
      `${location.pathname}${location.search}${location.hash}`,
    );
  }, [activeCase.id, location.hash, location.pathname, location.search]);

  // ── Copy handler (shared by inline button + action sheet) ──
  const handleCopy = useCallback(async () => {
    const cached = getCachedPrompt(activeCase.id);
    if (cached) {
      copy(cached);
      return;
    }
    setCopying(true);
    try {
      // Reuse the shared loader (timeout + de-dup + cache).
      const prompt = await loadPrompt(activeCase.id);
      if (prompt) {
        copy(prompt);
      } else if (activeCase.promptPreview) {
        // Empty prompt file — fall back to the preview so the user gets
        // *something* useful rather than an empty clipboard.
        copy(activeCase.promptPreview);
      } else {
        throw new Error("empty prompt");
      }
    } catch {
      // NEVER copy an empty string with a success toast. Try the preview as a
      // last resort; otherwise surface a real failure.
      if (activeCase.promptPreview) {
        copy(activeCase.promptPreview);
      } else {
        toast.error("Prompt 加载失败", {
          description: "网络不稳定，请打开详情页重试。",
        });
      }
    } finally {
      setCopying(false);
    }
  }, [activeCase.id, activeCase.promptPreview, copy]);

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
      label: activeFavorited ? "取消收藏" : "收藏",
      icon: <HeartIcon filled={activeFavorited} />,
      onSelect: () => onToggleFavorite(activeCase.id),
    },
    {
      key: "category",
      label: `更多 ${userCategoryLabel(activeCase.userCategory)}`,
      icon: <FolderIcon />,
      hint: "浏览同类型案例",
      onSelect: () => navigate(`/category/${activeCase.userCategory}`),
    },
  ];

  return (
    <>
      <article
        id={`case-${data.id}`}
        onMouseEnter={() => {
          if (typeof window === "undefined") return;
          if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            prefetchPrompt(activeCase.id);
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
        <div
          className="case-card-media relative overflow-hidden bg-ink-850"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { swipeStartRef.current = null; }}
          style={hasMultiple ? { touchAction: "pan-y" } : undefined}
        >
          <Link
            to={detailHref}
            onClick={rememberReturn}
            className="relative block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember-500/50"
            aria-label={`查看 ${accessibleCaseLabel(activeCase)}`}
          >
            {imgErr ? (
              <img
                key={`${activeSlide.caseId}-${activeSlide.imgIdx}`}
                src={FALLBACK}
                alt={activeSlide.alt}
                width={imageDimensions.width}
                height={imageDimensions.height}
                onLoad={onImageLoad}
                className="block h-auto w-full"
              />
            ) : (
              <SmartImg
                key={`${activeSlide.caseId}-${activeSlide.imgIdx}`}
                src={activeSlide.url}
                alt={activeSlide.alt}
                width={imageDimensions.width}
                height={imageDimensions.height}
                widths={[280, 420, 560, 800]}
                baseWidth={280}
                sizes="(min-width:1280px) 280px, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                loading={priority && !isSeriesActive ? "eager" : "lazy"}
                fetchPriority={priority && !isSeriesActive ? "high" : "auto"}
                preserveAspectRatio
                onLoad={onImageLoad}
                onError={() => setImgErr(true)}
                className="relative block w-full transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
              />
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-1/2 bg-gradient-to-t from-ink-950/90 via-ink-950/30 to-transparent opacity-0 transition duration-500 group-hover:opacity-100 sm:block" />

            {/* Hover overlay: author + view affordance (desktop) */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden items-end justify-between gap-2 p-3 opacity-0 transition duration-500 group-hover:opacity-100 sm:flex">
              <div className="min-w-0 flex-1 text-[11px] text-ink-200">
                {activeCase.source && (
                  <span className="truncate align-middle text-[11px] text-ink-300">
                    {sourceLabel}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-medium text-ink-50 backdrop-blur">
                查看
                <ArrowRightIcon />
              </span>
            </div>
          </Link>

          {hasMultiple && (
            <SeriesNav
              activeIdx={safeActiveIdx}
              total={slides.length}
              onSelect={setActiveIdxSafe}
            />
          )}

          <button
            type="button"
            data-no-longpress
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(activeCase.id);
            }}
            aria-label={activeFavorited ? "取消收藏" : "收藏"}
            aria-pressed={activeFavorited}
            className={
              "absolute right-2.5 top-2.5 z-20 grid h-11 w-11 place-items-center rounded-full border backdrop-blur-md transition sm:h-8 sm:w-8 " +
              (activeFavorited
                ? "border-ember-400/60 bg-ember-500/30 text-ember-100"
                : "border-white/25 bg-ink-950/65 text-ink-50 opacity-100 hover:border-ember-400/60 hover:text-ember-200 sm:border-white/15 sm:bg-ink-950/55 sm:opacity-0 sm:group-hover:opacity-100")
            }
          >
            <HeartIcon filled={activeFavorited} />
          </button>

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-ink-950 via-ink-950/90 to-transparent px-3 pb-3 pt-14 sm:hidden">
            <Link
              to={detailHref}
              onClick={rememberReturn}
              className="block rounded-sm text-[14px] font-semibold leading-snug text-ink-50 transition hover:text-ember-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70"
            >
              <span className="line-clamp-1">{activeCase.title}</span>
            </Link>
            <div className="flex items-center justify-between gap-2 text-[11.5px] text-ink-300">
              <span className="inline-flex min-w-0 items-center gap-1">
                <SourceDot />
                <span className="truncate">{activeCase.source ? sourceLabel : userCategoryLabel(activeCase.userCategory)}</span>
              </span>
              <span className="shrink-0 text-ink-400">{userCategoryLabel(activeCase.userCategory)}</span>
            </div>
            <div className="flex items-center gap-2" data-no-longpress>
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
                "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold transition disabled:opacity-60 " +
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
            {activeCase.promptPreview && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setPreviewOpen((value) => !value);
                }}
                aria-expanded={previewOpen}
                aria-controls={`prompt-preview-${activeCase.id}`}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-ink-800/70 bg-ink-900/80 px-3 text-[12px] font-medium text-ink-200 active:bg-ink-850/80"
              >
                {previewOpen ? "收起" : "预览"}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(true);
              }}
              aria-label="更多操作"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink-800/70 bg-ink-900/80 text-ink-200 active:bg-ink-850/80"
            >
              <DotsIcon />
            </button>
            </div>
          </div>
        </div>

        {/* DESKTOP FOOTER — title + author/category meta + always-on copy button */}
        <div className="hidden gap-2 px-3 pb-3 pt-2.5 sm:flex sm:flex-col sm:px-3.5 sm:pt-3">
          <Link
            to={detailHref}
            onClick={rememberReturn}
            className="block min-w-0 text-[13.5px] font-semibold leading-snug text-ink-100 transition group-hover:text-ember-200"
          >
            <span className="line-clamp-1">{activeCase.title}</span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-ink-400">
              {activeCase.source && (
                <>
                  <span className="inline-flex items-center gap-1 truncate text-ink-300">
                    <SourceDot />
                    {sourceLabel}
                  </span>
                  <span className="text-ink-600">·</span>
                </>
              )}
              <Link
                to={`/category/${activeCase.userCategory}`}
                className="truncate transition hover:text-ember-200"
                onClick={(e) => e.stopPropagation()}
              >
                {userCategoryLabel(activeCase.userCategory)}
              </Link>
              {tags.length > 0 && <span className="text-ink-600">·</span>}
              {tags.map((tag, i) => (
                <span key={`${activeCase.id}-${tag}`} className="truncate text-ink-300">
                  {tagLabel(tag)}
                  {i < tags.length - 1 && <span className="ml-1.5 text-ink-600">·</span>}
                </span>
              ))}
            </div>

            {activeCase.promptPreview && (
              <button
                type="button"
                data-no-longpress
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setPreviewOpen((value) => !value);
                }}
                aria-expanded={previewOpen}
                aria-controls={`prompt-preview-${activeCase.id}`}
                aria-label={previewOpen ? "收起 Prompt 预览" : "预览 Prompt"}
                className="inline-flex h-8 shrink-0 items-center rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[12px] font-medium text-ink-300 transition hover:border-ember-500/40 hover:text-ember-100"
              >
                {previewOpen ? "收起" : "预览"}
              </button>
            )}

            <button
              type="button"
              data-no-longpress
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
                  <span>复制 Prompt</span>
                </>
              )}
            </button>
          </div>
        </div>

        {activeCase.promptPreview && previewOpen && (
          <section
            id={`prompt-preview-${activeCase.id}`}
            className="border-t border-white/[0.06] bg-ink-950/45 px-3.5 py-3 sm:px-4"
            data-no-longpress
          >
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
                Prompt Preview
              </span>
              <Link
                to={detailHref}
                onClick={rememberReturn}
                className="text-[11.5px] font-medium text-ember-300 transition hover:text-ember-200"
              >
                查看完整 Prompt
              </Link>
            </div>
            <p className="line-clamp-5 text-[12px] leading-relaxed text-ink-300">
              {activeCase.promptPreview}
            </p>
          </section>
        )}
      </article>

      <CardActionSheet
        open={menuOpen}
        title={activeCase.title}
        caption={userCategoryLabel(activeCase.userCategory)}
        image={/^\/images\//i.test(activeCase.imageUrl) ? pickLocalWebp(activeCase.imageUrl, 168) : transformUrl(activeCase.imageUrl, { width: 168 })}
        actions={sheetActions}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}

/**
 * In-card carousel controls for a series. Renders a "N/M" counter pill in
 * the top-left, prev/next arrow buttons on the left/right edges, and a row
 * of pagination dots centered at the bottom. All controls:
 *   - stop propagation so they never trigger the image's `Link` navigation,
 *   - opt out of long-press (`data-no-longpress`) so the action sheet never
 *     fires from a tap on the controls.
 *
 * The parent media layer also receives horizontal swipe handling — see the
 * `onPointerDown` / `onPointerUp` props wired up in `CaseCardImpl`.
 */
function SeriesNav({
  activeIdx,
  total,
  onSelect,
}: {
  activeIdx: number;
  total: number;
  onSelect: (next: number) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="false">
      {/* Counter pill (top-left). Sits below the favorite button (z-20). */}
      <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex h-6 items-center rounded-full border border-white/15 bg-ink-950/65 px-2 text-[10.5px] font-medium tabular-nums text-ink-100 backdrop-blur-md">
        {activeIdx + 1}/{total}
      </span>

      {/* Prev arrow */}
      <button
        type="button"
        data-no-longpress
        aria-label="上一张"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(activeIdx - 1);
        }}
        className="pointer-events-auto absolute left-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-ink-950/65 text-ink-50 backdrop-blur-md transition hover:border-ember-400/50 hover:bg-ink-900/80 hover:text-ember-200 sm:left-2 sm:h-9 sm:w-9"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>

      {/* Next arrow */}
      <button
        type="button"
        data-no-longpress
        aria-label="下一张"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(activeIdx + 1);
        }}
        className="pointer-events-auto absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-ink-950/65 text-ink-50 backdrop-blur-md transition hover:border-ember-400/50 hover:bg-ink-900/80 hover:text-ember-200 sm:right-2 sm:h-9 sm:w-9"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>

      {/* Pagination dots — hidden on mobile footer hover gradient (kept above gradient via z-10) */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => {
          const active = i === activeIdx;
          return (
            <button
              key={i}
              type="button"
              data-no-longpress
              aria-label={`第 ${i + 1} 张`}
              aria-current={active ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(i);
              }}
              className={
                "pointer-events-auto h-1.5 rounded-full transition-all " +
                (active
                  ? "w-4 bg-ember-300"
                  : "w-1.5 bg-white/45 hover:bg-white/75")
              }
            />
          );
        })}
      </div>
    </div>
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
