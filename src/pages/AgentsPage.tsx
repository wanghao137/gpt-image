import { useState } from "react";
import { ALL_TEMPLATES } from "../lib/data";
import { SEO } from "../components/SEO";
import { useCopy } from "../hooks/useCopy";

const SKILL_CMD =
  "npx skills add freestylefly/awesome-gpt-image-2 --skill gpt-image-2-style-library --agent claude-code codex --global --yes --copy";
const SKILL_REQUEST = "Use gpt-image-2-style-library to create a city life system map.";

/**
 * Developer-facing landing for the awesome-gpt-image-2 Agent Skill.
 * Moved off the homepage where it was scaring off non-technical visitors.
 */
export default function AgentsPage() {
  const cmdCopy = useCopy(1500);
  const reqCopy = useCopy(1500);
  const [count] = useState(ALL_TEMPLATES.length);

  return (
    <>
      <SEO
        title="Agent Skill · 把 GPT-Image 2 风格库装进 Claude Code / Codex"
        description="一条 npx 命令把 GPT-Image 2 风格库与模板装进 Claude Code 和 Codex，本地 Agent 直接调用与本站同源的模板、风格、场景与防坑指南。"
        path="/agents"
      />

      <section className="container-narrow pt-10 sm:pt-14">
        <p className="eyebrow">Agent Skill</p>
        <h1 className="serif-display mt-2 text-[28px] leading-[1.1] text-ink-50 sm:text-4xl lg:text-[44px]">
          把 GPT-Image 2 风格库装进 Claude Code 与 Codex。
        </h1>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-300 sm:text-[15px]">
          一条命令完成安装，让你的本地 Agent 直接调用与本站同源的模板、风格、场景与防坑指南。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="chip chip-idle">Claude Code ready</span>
          <span className="chip chip-idle">Codex ready</span>
          <span className="chip chip-idle">{count}+ 模板</span>
        </div>
      </section>

      <section className="container-narrow grid gap-5 pb-16 pt-8">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-950/70">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
              <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">
                install · terminal
              </span>
            </div>
            <button
              type="button"
              onClick={() => cmdCopy.copy(SKILL_CMD)}
              className="text-[11px] font-medium text-ink-400 transition hover:text-ink-50"
            >
              {cmdCopy.state === "copied" ? "已复制" : "复制"}
            </button>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-ember-100 scrollbar-thin">
            <code>
              <span className="text-ink-500">$ </span>
              {SKILL_CMD}
            </code>
          </pre>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Try this request</p>
            <button
              type="button"
              onClick={() => reqCopy.copy(SKILL_REQUEST)}
              className="text-[11px] font-medium text-ink-400 transition hover:text-ink-50"
            >
              {reqCopy.state === "copied" ? "已复制" : "复制"}
            </button>
          </div>
          <p className="mt-2 break-all font-mono text-[13px] leading-relaxed text-ink-100">
            {SKILL_REQUEST}
          </p>
        </div>

        <a
          href="https://github.com/freestylefly/awesome-gpt-image-2/tree/main/agents/skills/gpt-image-2-style-library"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-ember-300 transition hover:text-ember-200"
        >
          查看技能源码
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M11 3a1 1 0 1 0 0 2h2.59l-6.3 6.29a1 1 0 0 0 1.42 1.42L15 6.41V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
            <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
          </svg>
        </a>
      </section>
    </>
  );
}
