import { memo, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import type { PromptTemplate } from "../types";
import { useCopy } from "../hooks/useCopy";
import { ImageLightbox } from "./ImageLightbox";
import { SmartImg } from "./SmartImg";
import {
  derivedCaseSearchHref,
  extractTemplateVariables,
} from "../lib/template-discovery.mjs";
import { sourceDisplayLabel } from "../lib/source-label.mjs";
import { templateTagLabel } from "../lib/labels";

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const visibleTags = data.tags.slice(0, 3);
  const hiddenTagCount = Math.max(0, data.tags.length - visibleTags.length);
  const variables = extractTemplateVariables(data.prompt);
  const derivedCaseIds = data.derivedFrom?.slice(0, 5) ?? [];
  const detailHref = `/template/${data.id}`;
  const sourceLabel = sourceDisplayLabel(
    data.sourceLabel ||
      (data.sourceType === "derived-case"
        ? "基于合并案例库自动派生"
        : data.sourceType === "manual"
          ? "本项目手动模板"
          : "上游模板库"),
    data.sourceUrl,
  );

  const handleSpotlight = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--y", `${event.clientY - rect.top}px`);
  }, []);

  return (
    <>
      <article
        onMouseMove={handleSpotlight}
        className={
          "card-spotlight group/card flex h-full flex-col overflow-hidden rounded-2xl border bg-ink-900/60 transition duration-500 hover:-translate-y-1 hover:border-white/[0.16] hover:shadow-soft " +
          (expanded ? "border-ember-500/35 shadow-ember" : "border-white/[0.06]")
        }
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-ink-850">
          <Link
            to={detailHref}
            className="group/media absolute inset-0 block focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember-400/70"
            aria-label={`查看模板详情：${data.title}`}
          >
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ink-850 to-ink-800" />
            )}
            <SmartImg
              src={data.cover}
              alt={data.title}
              width={800}
              height={500}
              widths={[420, 640, 800, 1080]}
              baseWidth={640}
              /* Mirrors the grid ladder in TemplatesPage/HomePage (2/3/4/5/6
                 columns). Only matters for the few /images covers — /uploads
                 covers render as a bare <img> with no srcset at all. */
              sizes="(min-width:1536px) 17vw, (min-width:1280px) 20vw, (min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
              onLoad={() => setImgLoaded(true)}
              className={
                "absolute inset-0 h-full w-full object-cover transition duration-[1100ms] group-hover/media:scale-[1.05] " +
                (imgLoaded ? "opacity-95" : "opacity-0")
              }
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
            <span className="absolute left-2 top-2 rounded-full border border-white/15 bg-ink-950/70 px-2 py-0.5 text-[9.5px] font-medium tracking-[0.12em] text-ember-200 backdrop-blur sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[10.5px] sm:tracking-[0.16em]">
              TEMPLATE
            </span>
          </Link>
          <button
            type="button"
            aria-label="查看模板大图"
            onClick={() => setLightboxOpen(true)}
            className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-ink-950/70 text-ink-100 shadow-soft backdrop-blur transition hover:border-ember-400/45 hover:bg-ember-500/15 hover:text-ember-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70 sm:right-3 sm:top-3 sm:h-11 sm:w-11 sm:rounded-xl"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
            </svg>
          </button>
        </div>

        <div className="relative z-[2] flex flex-1 flex-col gap-2.5 p-3.5 sm:gap-3 sm:p-5">
          <div className="eyebrow">{data.category}</div>
          <h3 className="text-[14.5px] font-semibold leading-snug text-ink-50 sm:text-[16px]">
            <Link
              to={detailHref}
              className="group/title flex items-start gap-1 rounded-sm transition hover:text-ember-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70"
            >
              <span className="flex-1">{data.title}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500 transition group-hover/title:translate-x-0.5 group-hover/title:text-ember-300"
                aria-hidden="true"
              >
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </Link>
          </h3>
          <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-400 sm:text-[13px]">{data.description}</p>

          {variables.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-ink-400 sm:text-[11.5px]">
              <span className="rounded-full border border-ember-400/20 bg-ember-400/[0.07] px-2 py-1 text-ember-200">
                {variables.length} 个可替换变量
              </span>
              <span>展开后逐项填写</span>
            </div>
          )}

          {visibleTags.length > 0 && (
            <div className="template-capability-strip" aria-label="模板适用方向">
              <span className="template-capability-label">适用方向</span>
              <div className="template-capability-tags">
                {visibleTags.map((tag) => (
                  <span key={`${data.id}-${tag}`} className="template-capability-tag" title={templateTagLabel(tag)}>
                    {templateTagLabel(tag)}
                  </span>
                ))}
                {hiddenTagCount > 0 && (
                  <span className="template-capability-more" aria-label={`还有 ${hiddenTagCount} 个适用方向`}>
                    +{hiddenTagCount}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* flex-wrap + basis: the two actions share a line only when the card
              is wide enough (~274px) for the widest label ("展开 Prompt" needs
              ~113px with its icon). A fixed 2-col grid overflowed the label at
              3-4 columns (640-1535px, cards 181-352px). */}
          <div className="mt-auto flex flex-wrap gap-2 pt-1.5 sm:pt-2">
            {expandable ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="inline-flex h-10 flex-1 basis-[112px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[12.5px] font-medium text-ink-200 transition hover:border-ember-500/40 hover:bg-ember-500/10 hover:text-ember-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70 sm:h-11"
                aria-expanded={expanded}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-4 w-4 transition duration-300 ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
                {expanded ? "收起 Prompt" : "展开 Prompt"}
              </button>
            ) : (
              <Link
                to={detailHref}
                className="inline-flex h-10 flex-1 basis-[112px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[12.5px] font-medium text-ink-200 transition hover:border-ember-500/40 hover:bg-ember-500/10 hover:text-ember-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70 sm:h-11"
              >
                查看详情
              </Link>
            )}
            <button
              type="button"
              onClick={() => copy(data.prompt)}
              className={
                "inline-flex h-10 flex-1 basis-[112px] items-center justify-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70 sm:h-11 " +
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
                    aria-hidden="true"
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
                    aria-hidden="true"
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
            <div className="mt-2 space-y-3 rounded-xl border border-white/[0.08] bg-ink-950/45 p-3">
              {data.useWhen && (
                <section>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
                    适用场景
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-ink-300">{data.useWhen}</p>
                </section>
              )}

              {variables.length > 0 && (
                <section>
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
                    先替换这些变量
                  </div>
                  <div className="grid gap-1.5">
                    {variables.slice(0, 8).map((variable) => (
                      <div
                        key={`${data.id}-${variable.name}`}
                        className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-[11.5px]"
                      >
                        <strong className="shrink-0 font-medium text-ink-200">{variable.name}</strong>
                        <span className="line-clamp-2 text-right text-ink-500">
                          {variable.defaultValue || "按任务填写"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {variables.length > 8 && (
                    <p className="mt-1.5 text-[11px] text-ink-500">
                      另有 {variables.length - 8} 个变量，可在完整 Prompt 中继续替换。
                    </p>
                  )}
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

              {derivedCaseIds.length > 0 && (
                <section className="border-t border-white/[0.06] pt-3">
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
                    派生参考案例
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {derivedCaseIds.map((caseId) => (
                      <Link
                        key={`${data.id}-${caseId}`}
                        to={derivedCaseSearchHref(caseId)}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-ink-300 transition hover:border-ember-400/35 hover:text-ember-200"
                      >
                        案例 #{caseId}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </article>
      <ImageLightbox
        open={lightboxOpen}
        src={data.cover}
        alt={data.title}
        caption={data.title}
        ratio="16:10"
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}

export const TemplateCard = memo(TemplateCardImpl);
