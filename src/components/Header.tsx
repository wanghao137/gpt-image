interface HeaderProps {
  caseCount: number;
  templateCount: number;
}

export function Header({ caseCount, templateCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#060914]/75 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <a href="#top" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 shadow-2xl shadow-cyan-950/30">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-300 text-sm font-black text-slate-950">G</span>
          <span className="text-sm font-black tracking-tight text-white sm:text-base">GPT-Image2 画廊</span>
        </a>

        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 rounded-xl border border-white/10 bg-white/[0.06] p-1 text-xs font-bold text-slate-300 shadow-2xl shadow-slate-950/20 md:flex">
            <a className="rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white" href="#gallery">案例</a>
            <a className="rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white" href="#templates">模板</a>
            <a className="rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white" href="#agent-skill">技能</a>
          </nav>
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-cyan-100 sm:block">
            {caseCount} 案例 · {templateCount} 模板
          </div>
          <a
            href="https://gpt-image2.canghe.ai"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/20"
          >
            对标站
          </a>
        </div>
      </div>
    </header>
  );
}
