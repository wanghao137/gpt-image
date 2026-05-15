import { useEffect, useState } from "react";
import type { PromptCase } from "../types";
import { useCopy } from "../hooks/useCopy";

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
       <rect width='320' height='400' fill='#0f172a'/>
       <text x='50%' y='50%' fill='#67e8f9' font-family='sans-serif' font-size='14'
             text-anchor='middle' dy='.3em'>image unavailable</text>
     </svg>`,
  );

export function CaseModal({ data, favorited, onClose, onToggleFavorite }: CaseModalProps) {
  const { state, copy } = useCopy();
  const [imgErr, setImgErr] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setImgErr(false);
    setPrompt(data?.prompt || "");
    setMessage("");
  }, [data?.id, data?.prompt]);

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

  const copyText = state === "copied" ? "已复制" : state === "error" ? "复制失败" : "复制 Prompt";
  const tags = [...new Set([...data.styles, ...data.scenes, ...data.tags])].slice(0, 8);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-xl sm:p-5"
    >
      <div className="grid max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/12 bg-[#070c1a] shadow-2xl shadow-cyan-950/30 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="relative min-h-0 bg-slate-950">
          <img
            src={imgErr ? FALLBACK : data.imageUrl}
            alt={data.imageAlt || data.title}
            onError={() => setImgErr(true)}
            className="h-72 w-full object-cover lg:h-full"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-4">
            <div className="inline-flex rounded-full border border-white/15 bg-slate-950/70 px-3 py-1 text-xs font-black text-cyan-100 backdrop-blur">
              原图 · 案例 {data.id}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] font-black text-cyan-100">{data.category}</span>
                <h2 className="mt-3 text-2xl font-black leading-tight text-white">{data.title}</h2>
                {data.source && <p className="mt-2 text-sm font-semibold text-slate-400">来源：{data.source}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="关闭" className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-slate-300 transition hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={`${data.id}-${tag}`} className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-slate-300">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-100/80">可编辑 Prompt</h3>
              <button type="button" onClick={() => setPrompt(data.prompt)} className="text-xs font-black text-slate-400 transition hover:text-white">
                重置 Prompt
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={6000}
              className="min-h-64 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-200/70 focus:ring-4 focus:ring-cyan-300/10"
            />
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-white">生成测试</p>
                  <p className="mt-1 text-xs text-slate-400">当前版本为静态前端，对齐入口和编辑体验，尚未接入真实生图服务。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMessage("生成服务还没有完成配置，后续可接入 /api/generate-image。")}
                  className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-300/20"
                >
                  生成图片
                </button>
              </div>
              {message && <p className="mt-3 text-xs font-bold text-amber-200">{message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-white/10 p-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onToggleFavorite(data.id)}
              className={
                "rounded-xl border px-4 py-2 text-sm font-black transition " +
                (favorited
                  ? "border-pink-300/50 bg-pink-300/15 text-pink-100"
                  : "border-white/10 bg-white/[0.06] text-slate-300 hover:border-pink-300/50 hover:text-pink-100")
              }
            >
              {favorited ? "已保存到本浏览器" : "收藏案例"}
            </button>
            <button type="button" onClick={() => copy(prompt)} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20">
              {copyText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
