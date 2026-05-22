import { memo, useCallback, useState } from "react";
import type { PromptTemplate } from "../types";
import { useCopy } from "../hooks/useCopy";
import { SmartImg } from "./SmartImg";

interface TemplateCardProps {
  data: PromptTemplate;
  expandable?: boolean;
  defaultExpanded?: boolean;
}

function TemplateCardImpl({ data, expandable = false, defaultExpanded = false }: TemplateCardProps) {
  const { state, copy } = useCopy(1500, {
    successTitle: "模板已复制",
    successDescription: "去 ChatGPT 粘贴并替换占位",
    successAction: {
      label: "打开 ChatGPT",
      href: "https://chat.openai.com/",
    },
  });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const tags = data.tags.slice(0, 3);
  const sourceLabel =
    data.sourceLabel ||
    (data.sourceType === "derived-case"
      ? "基于合并案例库自动派生"
      : data.sourceType === "manual"
        ? "本项目手动模板"
        : "上游模板库");

  const handleSpotlight = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - rect.top}px`);
  }, []);

  const toggleExpanded = useCallback(() => {
    if (!expandable) return;
    setExpanded((value) => !value);
  }, [expandable]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (!expandable || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      toggleExpanded();
    },
    [expandable, toggleExpanded],
  );

  return (
    <article
      aria-expanded={expandable ? expanded : undefined}
      onMouseMove={handleSpotlight}
      onClick={toggleExpanded}
      onKeyDown={handleKeyDown}
      tabIndex={expandable ? 0 : undefined}
      className={
        "card-spotlight group flex flex-col overflow-hidden rounded-2xl border bg-ink-900/60 transition duration-500 hover:-translate-y-1 hover:border-white/[0.16] hover:shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70 " +
        (expandable ? "cursor-pointer " : "") +
        (expanded ? "border-ember-500/35 shadow-ember" : "border-white/[0.06]")
      }
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-850">
        {!imgLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ink-850 to-ink-800" />
        )}
        <SmartImg
          src={data.cover}
          alt={data.title}
          width={800}
          height={500}
          widths={[420, 640, 800]}
          baseWidth={640}
          sizes="(min-width:1280px) 25vw, (min-width:640px) 50vw, 100vw"
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
          {expandable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-ink-200 transition hover:border-ember-500/40 hover:bg-ember-500/10 hover:text-ember-100"
              aria-label={expanded ? "收起模板内容" : "展开模板内容"}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={"h-4 w-4 transition duration-300 " + (expanded ? "rotate-180" : "")}
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
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

        {expandable && expanded && (
          <div
            className="mt-2 space-y-3 rounded-xl border border-white/[0.08] bg-ink-950/45 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {data.useWhen && (
              <section>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
                  Use When
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-300">{data.useWhen}</p>
              </section>
            )}

            <section>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
                Prompt
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/20 p-3 font-mono text-[11.5px] leading-relaxed text-ink-200">{data.prompt}</pre>
            </section>

            <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-3 text-[11.5px] text-ink-400 sm:flex-row sm:items-center sm:justify-between">
              <span>来源：{sourceLabel}</span>
              {data.sourceUrl && (
                <a
                  href={data.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit text-ember-300 transition hover:text-ember-200"
                >
                  查看数据源
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export const TemplateCard = memo(TemplateCardImpl);
