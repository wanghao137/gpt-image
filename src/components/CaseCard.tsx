import { useState } from "react";
import type { PromptCase } from "../types";
import { useCopy } from "../hooks/useCopy";

interface CaseCardProps {
  data: PromptCase;
  favorited: boolean;
  onSelect: (c: PromptCase) => void;
  onToggleFavorite: (id: string) => void;
  onGenerate: (c: PromptCase) => void;
}

const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 400'>
       <rect width='320' height='400' fill='#0f172a'/>
       <text x='50%' y='50%' fill='#67e8f9' font-family='sans-serif' font-size='14'
             text-anchor='middle' dy='.3em'>image unavailable</text>
     </svg>`,
  );

function previewText(data: PromptCase, max = 150): string {
  const text = data.promptPreview || data.prompt;
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > max ? trimmed.slice(0, max) + "..." : trimmed;
}

function tagsOf(data: PromptCase) {
  return [...new Set([...data.styles, ...data.scenes, ...data.tags])].slice(0, 4);
}

export function CaseCard({ data, favorited, onSelect, onToggleFavorite, onGenerate }: CaseCardProps) {
  const { state, copy } = useCopy();
  const [imgErr, setImgErr] = useState(false);

  const copyText = state === "copied" ? "已复制" : state === "error" ? "复制失败" : "复制 Prompt";

  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-[#090f20]/85 shadow-2xl shadow-slate-950/35 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/40 hover:shadow-cyan-950/30">
      <button type="button" onClick={() => onSelect(data)} className="relative block w-full overflow-hidden bg-slate-950 text-left">
        <div className="aspect-[4/5] overflow-hidden">
          <img
            src={imgErr ? FALLBACK : data.imageUrl}
            alt={data.imageAlt || data.title}
            loading="lazy"
            onError={() => setImgErr(true)}
            className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-105 group-hover:opacity-100"
          />
        </div>
        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-slate-950/70 px-2.5 py-1 text-xs font-black text-cyan-100 backdrop-blur">
          案例 {data.id}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full border border-white/15 bg-slate-950/70 px-2.5 py-1 text-xs font-bold text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
          查看详情
        </span>
      </button>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] font-black text-cyan-100">{data.category}</span>
          {data.source && <span className="truncate text-[11px] font-bold text-slate-500">{data.source}</span>}
        </div>

        <button type="button" onClick={() => onSelect(data)} className="block text-left">
          <h3 className="line-clamp-2 text-base font-black leading-tight text-white transition group-hover:text-cyan-100">{data.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">{previewText(data)}</p>
        </button>

        <div className="flex flex-wrap gap-1.5">
          {tagsOf(data).map((tag) => (
            <span key={`${data.id}-${tag}`} className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] font-bold text-slate-300">
              {tag}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copy(data.prompt);
            }}
            className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-black text-white transition hover:border-cyan-200/50 hover:bg-cyan-300/10"
          >
            {copyText}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onGenerate(data);
            }}
            className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:border-emerald-200/60 hover:bg-emerald-300/20"
          >
            生成测试
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(data.id);
            }}
            className={
              "rounded-xl border px-3 py-2 text-xs font-black transition " +
              (favorited
                ? "border-pink-300/50 bg-pink-300/15 text-pink-100"
                : "border-white/10 bg-white/[0.05] text-slate-300 hover:border-pink-300/50 hover:text-pink-100")
            }
          >
            {favorited ? "已收藏" : "收藏"}
          </button>
          {data.githubUrl ? (
            <a
              href={data.githubUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-center text-xs font-black text-slate-300 transition hover:border-white/30 hover:text-white"
            >
              GitHub
            </a>
          ) : (
            <button type="button" onClick={() => onSelect(data)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-slate-300 transition hover:text-white">
              详情
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
