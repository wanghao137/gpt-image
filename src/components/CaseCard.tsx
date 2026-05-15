import { useState } from "react";
import type { PromptCase } from "../types";
import { useCopy } from "../hooks/useCopy";

interface CaseCardProps {
  data: PromptCase;
  favorited: boolean;
  onSelect: (c: PromptCase) => void;
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

function previewText(data: PromptCase, max = 130): string {
  const text = data.promptPreview || data.prompt;
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

export function CaseCard({ data, favorited, onSelect, onToggleFavorite }: CaseCardProps) {
  const { state, copy } = useCopy();
  const [imgErr, setImgErr] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const tags = tagsOf(data);

  const copyLabel =
    state === "copied" ? (
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
    <article className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/60 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-soft">
      <button
        type="button"
        onClick={() => onSelect(data)}
        className="relative block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500/50"
        aria-label={`查看案例 ${data.id} - ${data.title}`}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-ink-850">
          {!imgLoaded && !imgErr && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ink-850 to-ink-800" />
          )}
          <img
            src={imgErr ? FALLBACK : data.imageUrl}
            alt={data.imageAlt || data.title}
            loading="lazy"
            decoding="async"
            onError={() => setImgErr(true)}
            onLoad={() => setImgLoaded(true)}
            className={
              "h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04] " +
              (imgLoaded ? "opacity-100" : "opacity-0")
            }
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950/95 via-ink-950/40 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
          <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-ink-950/70 px-2.5 py-1 text-[11px] font-medium tracking-wider text-ink-100 backdrop-blur">
            #{data.id}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(data.id);
            }}
            aria-label={favorited ? "取消收藏" : "收藏"}
            className={
              "absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border backdrop-blur transition " +
              (favorited
                ? "border-ember-400/60 bg-ember-500/20 text-ember-200"
                : "border-white/15 bg-ink-950/60 text-ink-200 opacity-0 hover:border-ember-400/60 hover:text-ember-200 group-hover:opacity-100")
            }
          >
            <HeartIcon filled={favorited} />
          </button>
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-ink-950/75 px-2.5 py-1 text-[11px] font-medium text-ink-100 opacity-0 backdrop-blur transition group-hover:opacity-100">
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
      </button>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
          <span className="truncate">{data.category}</span>
          {data.source && (
            <span className="truncate text-ink-500" title={data.source}>
              {data.source}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelect(data)}
          className="block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500/40"
        >
          <h3 className="line-clamp-1 text-[15px] font-semibold leading-snug text-ink-50 transition group-hover:text-ember-200">
            {data.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-400">
            {previewText(data)}
          </p>
        </button>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={`${data.id}-${tag}`} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copy(data.prompt);
            }}
            className={
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-medium transition " +
              (state === "copied"
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                : "border-white/10 bg-white/[0.03] text-ink-100 hover:border-ember-500/40 hover:bg-ember-500/10 hover:text-ember-100")
            }
          >
            {copyLabel}
          </button>
          {data.githubUrl && (
            <a
              href={data.githubUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="GitHub"
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-ink-300 transition hover:border-white/25 hover:text-ink-50"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.36-3.37-1.36-.46-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.13-4.55-5.04 0-1.11.39-2.02 1.03-2.74-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.4 9.4 0 0 1 12 7.07c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.74 0 3.92-2.34 4.78-4.57 5.03.36.32.68.94.68 1.9v2.81c0 .27.18.6.69.49A10.06 10.06 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
