import { ALL_TEMPLATES } from "../lib/data";
import { TemplateCard } from "../components/TemplateCard";
import { SEO } from "../components/SEO";
import { WeChatCTA } from "../components/WeChatCTA";

export default function TemplatesPage() {
  const templates = ALL_TEMPLATES;
  return (
    <>
      <SEO
        title={`${templates.length} 套 GPT-Image 2 工业级模板`}
        description="按用途分组的 GPT-Image 2 工业级 Prompt 模板：UI 截图 / 信息图 / 海报 / 产品 / 品牌 / 摄影 / 角色 / 场景叙事。复制即可用，含约束与防坑指南。"
        path="/templates"
      />
      <section className="container-narrow pt-10 sm:pt-14">
        <p className="eyebrow">Industrial Templates</p>
        <h1 className="serif-display mt-2 text-[28px] text-ink-50 sm:text-4xl lg:text-[44px]">
          {templates.length} 套工业级模板，先起稿再 remix
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-400 sm:text-[15px]">
          每套模板都从真实案例中提炼，包含结构、约束与防坑指南，适合直接复制后替换主体、场景、品牌和限制条件。
        </p>
      </section>

      <div className="container-narrow grid gap-5 pb-16 pt-8 sm:grid-cols-2 xl:grid-cols-4">
        {templates.map((t) => (
          <TemplateCard key={t.id} data={t} />
        ))}
      </div>

      <WeChatCTA />
    </>
  );
}
