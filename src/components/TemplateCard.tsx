import { memo, useCallback, useState } from "react";
import type { PromptTemplate } from "../types";
import { useCopy } from "../hooks/useCopy";

interface TemplateCardProps {
  data: PromptTemplate;
}

function TemplateCardImpl({ data }: TemplateCardProps) {
  const { state, copy } = useCopy();
  const [imgLoaded, setImgLoaded] = useState(false);
  const tags = data.tags.slice(0, 3);

  const handleSpotlight = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <article
      onMouseMove={handleSpotlight}
      className="card-spotlight group flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900/60 transition duration-500 hover:-translate-y-1 hover:border-white/[0.16] hover:shadow-soft"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-850">
        {!imgLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ink-850 to-ink-800" />
        )}
        <img
          src={data.cover}
          alt={data.title}
          width={800}
          height={500}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          className={
            "absolute inset-0 h-full w-full object-cover transition duration-[1100ms] group-hover:scale-[1.05] " +
            (imgLoaded ? "opacity-95" : "opacity-0")
          }
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-ink-950/70 px-2.5 py-1 text-[10.5px] font-medium tracking-[0.16em] text-ember-200 backdrop-blur">
          TEMPLATE
        </span>
      </div>

      <div className="relative z-[2] flex flex-1 flex-col gap-3 p-5">
        <div className="eyebrow">{data.category}</div>
        <h3 className="text-[16px] font-semibold leading-snug text-ink-50 transition group-hover:text-ember-200">
          {data.title}
        </h3>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-400">{data.description}</p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={`${data.id}-${tag}`} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => copy(data.prompt)}
            className={
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-medium transition " +
              (state === "copied"
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                : "border-white/10 bg-white/[0.03] text-ink-100 hover:border-ember-500/40 hover:bg-ember-500/10 hover:text-ember-100")
            }
          >
            {state === "copied" ? (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
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
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                复制模板
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export const TemplateCard = memo(TemplateCardImpl);
