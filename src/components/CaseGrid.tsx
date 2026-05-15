import type { PromptCase } from "../types";
import { CaseCard } from "./CaseCard";

interface CaseGridProps {
  cases: PromptCase[];
  favoriteIds: Set<string>;
  onSelect: (c: PromptCase) => void;
  onToggleFavorite: (id: string) => void;
  onGenerate: (c: PromptCase) => void;
}

export function CaseGrid({ cases, favoriteIds, onSelect, onToggleFavorite, onGenerate }: CaseGridProps) {
  if (cases.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-10 shadow-2xl shadow-slate-950/40">
          <p className="text-base font-black text-white">暂无匹配案例</p>
          <p className="mt-2 text-sm text-slate-400">换个关键词、分类、风格或场景试试</p>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cases.map((item) => (
          <CaseCard
            key={item.id}
            data={item}
            favorited={favoriteIds.has(item.id)}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
            onGenerate={onGenerate}
          />
        ))}
      </div>
    </section>
  );
}
