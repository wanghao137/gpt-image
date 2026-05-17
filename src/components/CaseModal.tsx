import { useEffect, useState } from "react";
import type { PromptCase } from "../types";
import { useCopy } from "../hooks/useCopy";
import { usePrompt } from "../hooks/usePrompt";
import { tagLabel } from "../lib/labels";
import { SmartImg } from "./SmartImg";

interface CaseModalProps {
  data: PromptCase | null;
  favorited: boolean;
  onClose: () => void;
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

export function CaseModal({ data, favorited, onClose, onToggleFavorite }: CaseModalProps) {
  const { state, copy } = useCopy();
  const [imgErr, setImgErr] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [edited, setEdited] = useState(false);

  const fetched = usePrompt(data?.id ?? null);

  // Reset local prompt state when the active case changes / when fetched updates.
  useEffect(() => {
    setImgErr(false);
    setEdited(false);
  }, [data?.id]);

  useEffect(() => {
    if (!edited) setPrompt(fetched.prompt);
  }, [fetched.prompt, edited]);

  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [data, onClose]);

  if (!data) return null;

  const tags = Array.from(new Set([...data.styles, ...data.scenes, ...data.tags])).slice(0, 8);
  const charCount = prompt.length;
  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/80 p-0 backdrop-blur-md sm:items-center sm:p-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={data.title}
    >
      <div className="grid max-h-[94vh] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-3xl border border-white/[0.08] bg-ink-900 shadow-soft sm:rounded-3xl lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:grid-rows-1">
        {/* Image side */}
        <div className="relative min-h-0 bg-ink-950">
          {imgErr ? (
            <img
              src={FALLBACK}
              alt={data.imageAlt || data.title}
              width={1200}
              height={1500}
              className="h-56 w-full object-cover sm:h-72 lg:h-full"
            />
          ) : (
            <SmartImg
              src={data.imageUrl}
              alt={data.imageAlt || data.title}
              width={1200}
              height={1500}
              widths={[720, 1080, 1440]}
              baseWidth={1080}
              sizes="(min-width:1024px) 50vw, 100vw"
              loading="eager"
              fetchPriority="high"
              quality={82}
              onError={() => setImgErr(true)}
              className="h-56 w-full object-cover sm:h-72 lg:h-full"
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent p-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-ink-950/70 px-3 py-1 text-[11px] font-medium tracking-wider text-ink-100 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-ember-400" />
              CASE #{data.id}
            </div>
          </div>
        </div>

        {/* Info side */}
        <div className="flex min-h-0 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-5 sm:p-6">
            <div className="min-w-0 flex-1">
              <div className="eyebrow">{data.category}</div>
              <h2 className="serif-display mt-2 text-2xl leading-[1.1] text-ink-50 sm:text-3xl">
                {data.title}
              </h2>
              {data.source && (
                <p className="mt-2 text-[13px] text-ink-400">
                  来源 ·{" "}
                  <span className="font-medium text-ink-200">{data.source}</span>
                </p>
              )}
              {tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={`${data.id}-${tag}`} className="tag">
                      {tagLabel(tag)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ink-300 transition hover:border-white/25 hover:text-ink-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-6 scrollbar-thin">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="eyebrow">Prompt</h3>
                {fetched.loading && (
                  <span className="text-[11px] text-ink-500">加载中…</span>
                )}
                {fetched.error && (
                  <span className="text-[11px] text-rose-300">加载失败</span>
                )}
                {edited && (
                  <span className="rounded-full border border-ember-500/30 bg-ember-500/10 px-2 py-0.5 text-[10px] font-medium text-ember-200">
                    已编辑
                  </span>
                )}
              </div>
              {edited && (
                <button
                  type="button"
                  onClick={() => {
                    setPrompt(fetched.prompt);
                    setEdited(false);
                  }}
                  className="text-[12px] font-medium text-ink-400 transition hover:text-ink-50"
                >
                  恢复原版
                </button>
              )}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setEdited(e.target.value !== fetched.prompt);
              }}
              maxLength={6000}
              spellCheck={false}
              placeholder={fetched.loading ? "正在加载完整 Prompt…" : data.promptPreview || ""}
              className="min-h-[14rem] w-full resize-none rounded-2xl border border-white/[0.08] bg-ink-950/60 p-4 font-mono text-[13px] leading-relaxed text-ink-100 outline-none transition placeholder:text-ink-500 focus:border-ember-500/50 focus:ring-2 focus:ring-ember-500/15 sm:min-h-[16rem]"
            />
            <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-ink-500">
              <span>
                {charCount} 字符 · {wordCount} 词
              </span>
              <span>最多 6000 字符</span>
            </div>

            {data.githubUrl && (
              <a
                href={data.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-[13px] font-medium text-ink-300 transition hover:text-ember-200"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.36-3.37-1.36-.46-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.13-4.55-5.04 0-1.11.39-2.02 1.03-2.74-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.42 9.42 0 0 1 12 7.07c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.74 0 3.92-2.34 4.78-4.57 5.03.36.32.68.94.68 1.9v2.81c0 .27.18.6.69.49A10.06 10.06 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
                    clipRule="evenodd"
                  />
                </svg>
                在 GitHub 上查看原始 Prompt
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                  <path d="M11 3a1 1 0 1 0 0 2h2.59l-6.3 6.29a1 1 0 0 0 1.42 1.42L15 6.41V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
                  <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
                </svg>
              </a>
            )}
          </div>

          <div
            className="flex flex-col-reverse gap-2 border-t border-white/[0.06] p-4 sm:flex-row sm:justify-end"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => onToggleFavorite(data.id)}
              className={
                "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition " +
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
              {favorited ? "已收藏" : "收藏案例"}
            </button>
            <button
              type="button"
              disabled={fetched.loading || (!fetched.prompt && !prompt)}
              onClick={() => copy(prompt || fetched.prompt)}
              className={
                "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition disabled:opacity-50 " +
                (state === "copied"
                  ? "bg-emerald-400 text-ink-950"
                  : state === "error"
                    ? "bg-rose-400 text-ink-950"
                    : "bg-ember-500 text-ink-950 hover:bg-ember-400")
              }
            >
              {state === "copied" ? (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12 5 5 9-11" />
                  </svg>
                  已复制
                </>
              ) : state === "error" ? (
                "复制失败"
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {fetched.loading ? "加载中" : "复制 Prompt"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
