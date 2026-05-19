import { Link } from "react-router-dom";
import { SEO, SITE } from "../components/SEO";

// Pricing intentionally omitted while the productized quoting flow is still
// being shaped. The page used to show three tiers + price anchors, but we
// pulled them: posting numbers we can't actually honor at scale was creating
// expectation gaps in WeChat. For now the page is positioned as a contact /
// inquiry surface — concrete quotes happen 1:1 over WeChat after we see the
// brief. When we have a real price sheet, restore PRICING + Offer schema
// from git history.

const SCENARIOS = [
  { title: "小红书博主", desc: "高点击封面、风格一致的 9:16 视觉" },
  { title: "餐饮 / 美业 / 教培商家", desc: "促销海报、节日营销、九宫格朋友圈" },
  { title: "电商卖家", desc: "主图 / 详情页配图 / 包装视觉" },
  { title: "自媒体 / 公众号", desc: "封面图、信息图、长图配图" },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "出图周期一般多久？修改怎么算？",
    a: "单图通常 48 小时内交付，复杂的多图项目当周排期。每张包含 3 次免费修改，超出后再合并到下一轮迭代里，不会临时收费。",
  },
  {
    q: "能保证 100% 还原我的需求吗？",
    a: "我会先用 1–2 张草图确认大方向。方向确认后，最终交付通常需要 2–3 轮微调。AI 出图存在不可控因素，但可以通过反复迭代逼近期望，绝对一致需要更多轮次或换工种。",
  },
  {
    q: "可以商用 / 印刷吗？",
    a: "可以。出图全部使用合规商用 API。涉及人物形象、品牌标识、商标元素时建议先沟通，避免版权风险。客户拿到的是可商用的成品图。",
  },
  {
    q: "能不能换风格？",
    a: "案例库里看得到的所有风格都能做：胶片人像、3D IP 形象、信息图、品牌 KV、儿童写真、节日海报等。看到喜欢的案例直接发我对应链接即可。",
  },
  {
    q: "需要我提供什么资料？",
    a: "通用情况下：参考风格 / 文字内容 / 比例平台 / 颜色品牌色。涉及人像可提供 1–3 张身份参考图。资料越完整出图越准。",
  },
];

export default function ServicesPage() {
  // schema.org Service + FAQPage — helps Google show rich results.
  // Offer schema is intentionally omitted: no price, no offer.
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "GPT-Image 2 中文定制出图服务",
    provider: { "@type": "Organization", name: SITE.name, url: SITE.url },
    areaServed: { "@type": "Country", name: "China" },
    description:
      "按需定制 GPT-Image 2 中文出图：小红书封面、商家海报、人像写真、电商主图。48 小时交付，免费修改 3 次。",
    serviceType: "AI 图像生成 / 视觉定制",
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <SEO
        title="代做 / 定制 · 小红书封面 · 商家海报 · 人像写真"
        description="按需定制 GPT-Image 2 出图服务。48 小时交付，免费修改 3 次，4K 高清，已为 60+ 客户合作。"
        path="/services"
        jsonLd={[serviceLd, faqLd]}
      />

      <section className="container-narrow pt-10 sm:pt-14">
        <p className="eyebrow">Custom Services</p>
        <h1 className="serif-display mt-2 text-[28px] text-ink-50 sm:text-4xl lg:text-[44px]">
          按需定制 GPT-Image 2 出图。
          <br />
          48 小时交付。
        </h1>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-300 sm:text-[15px]">
          从小红书封面、商家海报到人像写真和电商主图，由站长亲自出图，免费修改 3 次。已与 60+
          博主和商家长期合作。
        </p>

        <div className="mt-7 flex flex-wrap gap-2 text-[12.5px]">
          {SCENARIOS.map((s) => (
            <span
              key={s.title}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-medium text-ink-200"
              title={s.desc}
            >
              {s.title}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href="#wechat" className="btn-primary">
            微信咨询
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
                clipRule="evenodd"
              />
            </svg>
          </a>
          <a href="#faq" className="btn-ghost">
            常见问题
          </a>
        </div>
      </section>

      {/* HOW IT WORKS — replaces the old PRICING grid; same visual rhythm,
          no numbers we can't honor yet. */}
      <section className="container-narrow scroll-mt-20 py-12 sm:py-16">
        <h2 className="serif-display text-[24px] text-ink-50 sm:text-3xl">合作流程</h2>
        <p className="mt-2 text-[14px] text-ink-400">
          每个项目都从一次具体沟通开始。把需求发我，我先评估方向再给方案。
        </p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "微信发需求",
              body: "把参考图、品牌色、平台、文字内容打包发我。1 小时内反馈方向是否能做，以及大致工时。",
            },
            {
              step: "02",
              title: "草图确认方向",
              body: "先用 1–2 张草图锁定大方向，避免后期返工。方向确认后再开始正式出图。",
            },
            {
              step: "03",
              title: "出图 + 微调交付",
              body: "48 小时内交付首版。每张包含 3 次免费修改，4K 高清成品 + 可商用授权。",
            },
          ].map((item) => (
            <li
              key={item.step}
              className="surface relative flex flex-col p-6"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ember-300">
                Step {item.step}
              </span>
              <strong className="mt-2 text-[16px] font-semibold text-ink-50">
                {item.title}
              </strong>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-300">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* WECHAT QR */}
      <section id="wechat" className="container-narrow scroll-mt-20 pb-16">
        <div className="surface relative overflow-hidden p-7 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-center">
            <div>
              <p className="eyebrow">Get in touch</p>
              <h2 className="serif-display mt-2 text-[26px] text-ink-50 sm:text-4xl">
                扫码加微信，备注「来自 Gallery」
              </h2>
              <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink-300 sm:text-[15px]">
                工作日 10:00–22:00 在线。把你的需求 / 参考图发给我，我会在 1 小时内反馈是否能做以及大致方向。
              </p>
              <ul className="mt-5 grid gap-2 text-[13.5px] text-ink-200 sm:grid-cols-2">
                <li>· 不收顾问费 / 沟通成本</li>
                <li>· 方向确认后才开始出图</li>
                <li>· 可签合同 + 开发票</li>
                <li>· 接受微信 / 支付宝 / 对公</li>
              </ul>
            </div>
            <div className="surface mx-auto w-full max-w-[260px] p-5 text-center">
              <div className="grid place-items-center">
                <div className="grid h-44 w-44 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500">
                  扫码 · 占位
                </div>
              </div>
              <p className="mt-3 text-[12.5px] font-semibold text-ink-100">微信扫码</p>
              <p className="text-[11.5px] text-ink-500">替换 /public/wechat-qr.png 为你的二维码</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container-narrow scroll-mt-20 pb-16">
        <h2 className="serif-display text-[24px] text-ink-50 sm:text-3xl">常见问题</h2>
        <p className="mt-2 text-[14px] text-ink-400">没找到答案？直接微信问也行。</p>
        <div className="mt-6 grid gap-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="surface group p-5 transition open:bg-white/[0.04]"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-[15px] font-semibold text-ink-50 marker:hidden">
                {f.q}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ink-300 transition group-open:rotate-45 group-open:bg-ember-500/15 group-open:text-ember-200">
                  +
                </span>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-300">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CASES TEASER */}
      <section id="cases" className="container-narrow scroll-mt-20 pb-20">
        <h2 className="serif-display text-[22px] text-ink-50 sm:text-3xl">先看作品风格</h2>
        <p className="mt-2 text-[14px] text-ink-400">案例库里所有图都是真实出图。</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/category/portrait" className="chip chip-idle">人像写真</Link>
          <Link to="/category/poster-general" className="chip chip-idle">海报与排版</Link>
          <Link to="/category/merchant-poster" className="chip chip-idle">商家海报</Link>
          <Link to="/category/ecommerce" className="chip chip-idle">电商产品图</Link>
          <Link to="/category/3d-ip" className="chip chip-idle">3D · IP 形象</Link>
          <Link to="/cases" className="chip chip-active">全部案例 →</Link>
        </div>
      </section>
    </>
  );
}
