import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";
import { WeChatCTA } from "../components/WeChatCTA";

const TOPICS = [
  {
    title: "GPT-Image 2 是什么 / 在哪用",
    body: "GPT-Image 2 是 OpenAI 在 ChatGPT 与 API 中提供的最新图像模型，长文本理解、海报排版、中文渲染都比上一代强很多。可以在 ChatGPT Plus 与企业账户里直接使用，也可以通过 API 集成到自己的工具里。",
  },
  {
    title: "中英 Prompt 怎么选",
    body: "中文 Prompt 在中文海报、节日营销、东方主题上效果非常好；英文 Prompt 在写实人像、品牌广告、城市旅行海报上更稳定。本站每个详情页都提供两种版本，遇到长文本渲染需求建议英文。",
  },
  {
    title: "比例与平台怎么搭",
    body: "小红书封面 / 朋友圈竖图首选 9:16；电商主图首选 1:1；商家横幅首选 16:9；信息图与百科海报首选 3:4 或 A4。",
  },
  {
    title: "可商用与版权",
    body: "AI 出图的商用边界与每个平台政策都不同。涉及品牌、人像参照、商标元素时建议先咨询本站定制服务，避免版权风险。",
  },
];

export default function GuidePage() {
  return (
    <>
      <SEO
        title="新手教程 · GPT-Image 2 怎么用"
        description="GPT-Image 2 是什么、怎么用、Prompt 怎么写、中英版本怎么选、可商用边界——零基础上手指南。"
        path="/guide"
      />

      <section className="container-narrow pt-10 sm:pt-14">
        <p className="eyebrow">Getting started</p>
        <h1 className="serif-display mt-2 text-[28px] text-ink-50 sm:text-4xl lg:text-[44px]">
          GPT-Image 2 上手指南
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-400 sm:text-[15px]">
          没有 ChatGPT Plus / 没接 API 也能看懂。先打通基本认知，再去
          <Link to="/cases" className="text-ember-300 hover:text-ember-200"> 案例库 </Link>
          复制 Prompt。
        </p>
      </section>

      <section className="container-narrow grid gap-6 pb-12 pt-8 sm:grid-cols-2">
        {TOPICS.map((t) => (
          <article key={t.title} className="surface p-6">
            <h2 className="serif-display text-[22px] text-ink-50">{t.title}</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-300">{t.body}</p>
          </article>
        ))}
      </section>

      <section className="container-narrow pb-12">
        <div className="surface p-6 sm:p-8">
          <h2 className="serif-display text-[22px] text-ink-50 sm:text-2xl">下一步</h2>
          <ul className="mt-4 grid gap-2 text-[14px] text-ink-200 sm:grid-cols-2">
            <li>
              <Link to="/cases" className="hover:text-ember-200">→ 浏览案例库</Link>
            </li>
            <li>
              <Link to="/templates" className="hover:text-ember-200">→ 拿一套工业模板起稿</Link>
            </li>
            <li>
              <Link to="/category/xhs-cover" className="hover:text-ember-200">→ 直接看小红书封面分类</Link>
            </li>
            <li>
              <Link to="/services" className="hover:text-ember-200">→ 没时间？让我帮你出</Link>
            </li>
          </ul>
        </div>
      </section>

      <WeChatCTA />
    </>
  );
}
