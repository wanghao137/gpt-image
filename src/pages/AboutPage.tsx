import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";
import { BRAND } from "../lib/brand";

export default function AboutPage() {
  return (
    <>
      <SEO
        title={`关于 · ${BRAND.name}`}
        description={`${BRAND.name}是一个按场景重新整理的 GPT-Image 2 案例与 Prompt 模板库。所有案例都附中英双语 Prompt，可一键复制后粘贴到 ChatGPT 出图。`}
        path="/about"
      />

      <section className="container-narrow pt-10 sm:pt-14">
        <p className="eyebrow">About</p>
        <h1 className="serif-display mt-2 text-[28px] text-ink-50 sm:text-4xl lg:text-[44px]">
          {BRAND.name}，为出图而生。
        </h1>
      </section>

      <section className="container-narrow grid gap-6 py-10 sm:grid-cols-2">
        <article className="surface p-6">
          <h2 className="serif-display text-[22px] text-ink-50">为什么做这个站</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-300">
            国内大部分 AI 案例库要么是英文的，要么是“工种向”分类。我希望小红书博主、商家和设计师能直接按场景找到能用的 Prompt。
          </p>
        </article>
        <article className="surface p-6">
          <h2 className="serif-display text-[22px] text-ink-50">怎么用</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-300">
            按场景或风格筛选 → 看图找灵感 → 一键复制 Prompt → 在 ChatGPT 里粘贴出图。所有 Prompt 都附中英双语，方便直接喂给模型。
          </p>
        </article>
        <article className="surface p-6">
          <h2 className="serif-display text-[22px] text-ink-50">数据来源</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-300">
            数据来自社区精选，主要源自{" "}
            <a
              href="https://github.com/YouMind-OpenLab/gpt-image-2-prompts-search"
              target="_blank"
              rel="noreferrer"
              className="text-ember-300 hover:text-ember-200"
            >
              YouMind GPT Image 2 Prompts
            </a>{" "}
            等公开整理仓库。每条案例都附原作者署名与原始链接。
          </p>
        </article>
        <article className="surface p-6">
          <h2 className="serif-display text-[22px] text-ink-50">还想要什么</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-300">
            欢迎到{" "}
            <Link to="/cases" className="text-ember-300 hover:text-ember-200">
              全部案例
            </Link>{" "}
            按场景刷一刷。觉得缺了某类用例可以去 GitHub 提 issue。
          </p>
        </article>
      </section>
    </>
  );
}
