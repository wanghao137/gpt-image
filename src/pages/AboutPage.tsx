import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";
import { BRAND } from "../lib/brand";

export default function AboutPage() {
  return (
    <>
      <SEO
        title={`关于与使用说明 · ${BRAND.name}`}
        description={`${BRAND.name}的数据来源、内容边界、使用方式、版权提示与隐私说明。`}
        path="/about"
      />

      <section className="container-narrow pt-10 sm:pt-14">
        <p className="eyebrow">About · Trust</p>
        <h1 className="serif-display mt-2 max-w-4xl text-[28px] leading-tight text-ink-50 sm:text-4xl lg:text-[44px]">
          用真实案例降低试错，也把来源与使用边界说清楚。
        </h1>
        <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-ink-300 sm:text-[15px]">
          {BRAND.name}按创作任务整理 GPT-Image 2 案例与 Prompt 模板，帮助内容创作者、商家和设计师更快找到可参考的视觉方向。
        </p>
      </section>

      <section className="container-narrow grid gap-5 py-10 sm:grid-cols-2">
        <InfoCard title="怎么使用">
          先按场景、平台或风格筛选，再查看图片与 Prompt。复制后请根据自己的主体、品牌、用途和限制条件重新调整，不建议把示例当作无需修改的最终成品。
        </InfoCard>
        <InfoCard title="内容边界">
          案例标题、分类、标签和中文辅助说明可能经过站内整理；部分 Prompt 仅提供预览，完整内容会在详情页按需加载。页面不会承诺所有案例都具备中英双语或可直接商用。
        </InfoCard>
      </section>

      <section id="sources" className="container-narrow scroll-mt-24 pb-8" aria-labelledby="sources-title">
        <div className="surface p-6 sm:p-8">
          <p className="eyebrow">Sources · Licensing</p>
          <h2 id="sources-title" className="serif-display mt-2 text-[24px] text-ink-50 sm:text-[30px]">
            来源与授权提示
          </h2>
          <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-ink-300">
            <p>
              内容来自公开资料、社区整理与站内人工补充，主要参考
              {" "}
              <a
                href="https://github.com/YouMind-OpenLab/gpt-image-2-prompts-search"
                target="_blank"
                rel="noreferrer"
                className="text-ember-300 underline-offset-4 hover:text-ember-200 hover:underline"
              >
                YouMind GPT Image 2 Prompts
              </a>
              等公开项目。页面显示的“来源”可能是平台、整理者或账号标识，不一定等同于原始版权所有者。
            </p>
            <p>
              图片、品牌、人物形象与 Prompt 的相关权利归原权利人所有。用于商业发布、广告投放、品牌资产或人物肖像前，请自行核对原始来源、授权条款和适用法律；来源不明确时应按“需要进一步确认”处理。
            </p>
          </div>
        </div>
      </section>

      <section id="privacy" className="container-narrow scroll-mt-24 pb-12" aria-labelledby="privacy-title">
        <div className="surface p-6 sm:p-8">
          <p className="eyebrow">Privacy · Analytics</p>
          <h2 id="privacy-title" className="serif-display mt-2 text-[24px] text-ink-50 sm:text-[30px]">
            隐私与访问统计
          </h2>
          <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-ink-300">
            <p>
              站点使用基础访问统计了解页面使用情况，包括访问路径、来源域名、设备/浏览器/系统类别和国家或地区。访客标识由 IP、User-Agent、日期与服务端盐值生成每日哈希，不保存原始 IP，也不用于跨日识别个人。
            </p>
            <p>
              收藏内容保存在当前浏览器的本地存储中。站点不要求注册账户，也不会因复制 Prompt 或浏览案例而收集你的 Prompt 内容。
            </p>
          </div>
        </div>
      </section>

      <section className="container-narrow pb-16">
        <div className="flex flex-wrap gap-3">
          <Link to="/cases" className="btn-primary">浏览全部案例</Link>
          <Link to="/templates" className="btn-ghost">查看 Prompt 模板</Link>
        </div>
      </section>
    </>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="surface p-6">
      <h2 className="serif-display text-[22px] text-ink-50">{title}</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-300">{children}</p>
    </article>
  );
}
