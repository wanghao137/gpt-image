import { memo, useState } from "react";
import { Link } from "react-router-dom";
import type { PromptTemplate } from "../types";
import { useCopy } from "../hooks/useCopy";
import { ImageLightbox } from "./ImageLightbox";
import { SmartImg } from "./SmartImg";

interface TemplateCardProps {
  data: PromptTemplate;
}

/**
 * Image-first template card for the masonry wall.
 *
 * The cover renders at its NATURAL aspect ratio (preserveAspectRatio) —
 * portrait posters are the largest cover group and used to be cropped to a
 * sliver inside a fixed 16:10 box. The card carries exactly two things:
 * the cover (tap → detail) and a title + 复制模板 footer. Category,
 * description, variables and tags live on the detail page.
 */
function TemplateCardImpl({ data }: TemplateCardProps) {
  const { state, copy } = useCopy(1500, {
    successTitle: "模板已复制",
    successDescription: "去 ChatGPT 粘贴并替换占位",
    successAction: {
      label: "打开 ChatGPT",
      href: "https://chat.openai.com/",
    },
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const detailHref = `/template/${data.id}`;

  return (
    <>
      <article className="group block break-inside-avoid overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5 transition hover:border-ember-400/40 hover:bg-white/[0.05]">
        <div className="relative overflow-hidden rounded-lg bg-ink-900/60">
          <Link
            to={detailHref}
            aria-label={`查看模板详情：${data.title}`}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70"
          >
            {/* alt stays empty: the footer title link is the accessible name,
                so screen readers don't announce the title twice */}
            <SmartImg
              src={data.cover}
              alt=""
              width={600}
              height={900}
              preserveAspectRatio
              loading="lazy"
              decoding="async"
              className="overflow-hidden rounded-md"
            />
          </Link>
          <span className="pointer-events-none absolute left-2 top-2 rounded-full border border-white/15 bg-ink-950/70 px-2 py-0.5 text-[9.5px] font-medium tracking-[0.12em] text-ember-200 backdrop-blur">
            TEMPLATE
          </span>
          <button
            type="button"
            aria-label="查看模板大图"
            onClick={() => setLightboxOpen(true)}
            className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-ink-950/70 text-ink-100 backdrop-blur transition hover:border-ember-400/45 hover:bg-ember-500/15 hover:text-ember-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
            </svg>
          </button>
        </div>

        <div className="px-1 pt-1.5">
          <h3 className="line-clamp-2 text-[12.5px] font-medium leading-snug text-ink-100 transition group-hover:text-ink-50">
            <Link to={detailHref} className="transition hover:text-ember-200">
              {data.title}
            </Link>
          </h3>
        </div>

        <div className="p-1 pt-1.5">
          <button
            type="button"
            onClick={() => copy(data.prompt)}
            className={
              "inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg text-[11.5px] font-semibold transition " +
              (state === "copied"
                ? "bg-emerald-400/95 text-ink-950"
                : state === "error"
                  ? "bg-rose-400/90 text-ink-950"
                  : "bg-ember-500/95 text-ink-950 active:bg-ember-400")
            }
          >
            {state === "copied" ? (
              "已复制"
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
                  className="h-3.5 w-3.5"
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
      </article>
      <ImageLightbox
        open={lightboxOpen}
        src={data.cover}
        alt={data.title}
        caption={data.title}
        ratio="4:5"
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}

export const TemplateCard = memo(TemplateCardImpl);
