import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";
import { WeChatCTA } from "../components/WeChatCTA";

export default function AboutPage() {
  return (
    <>
      <SEO
        title="关于我 · GPT-Image 2 中文案例库"
        description="一名长期做 AI 生图副业与产品的设计/开发者，运营 GPT-Image 2 中文案例库，提供小红书封面、商家海报、人像写真等定制服务。"
        path="/about"
      />

      <section className="container-narrow pt-10 sm:pt-14">
        <p className="eyebrow">About</p>
        <h1 className="serif-display mt-2 text-[28px] text-ink-50 sm:text-4xl lg:text-[44px]">
          一个人，把 AI 生图做成认真的事。
        </h1>
      </section>

      <section className="container-narrow grid gap-6 py-10 sm:grid-cols-2">
        <article className="surface p-6">
          <h2 className="serif-display text-[22px] text-ink-50">为什么做这个站</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-300">
            国内大部分 AI 案例库要么是英文的，要么是“工种向”分类。我希望小红书博主、商家和设计师能直接按场景找到能用的 Prompt，并能在需要时把出图工作交给我。
          </p>
        </article>
        <article className="surface p-6">
          <h2 className="serif-display text-[22px] text-ink-50">我是谁</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-300">
            做产品 / 前端 / 设计十多年。最近两年专注 AI 生图工作流，已为 60+ 博主和商家产出小红书封面、商家海报、人像写真与电商主图。
          </p>
        </article>
        <article className="surface p-6">
          <h2 className="serif-display text-[22px] text-ink-50">我能做什么</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-300">
            从一句话需求到 4K 出图：抓视觉方向、写 Prompt、出多版、修改打磨、可商用交付。涉及 Logo / KV / VI 时也能进入更深定制。
          </p>
        </article>
        <article className="surface p-6">
          <h2 className="serif-display text-[22px] text-ink-50">怎么联系</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-300">
            微信扫码（见
            <Link to="/services#wechat" className="text-ember-300 hover:text-ember-200"> /services </Link>
            ），备注「来自 Gallery」。工作日 10:00–22:00 在线。
          </p>
        </article>
      </section>

      <WeChatCTA />
    </>
  );
}
