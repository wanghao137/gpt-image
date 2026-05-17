import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";

const PRICING = [
  {
    tier: "单图定制",
    price: "¥ 50 起",
    cadence: "/ 张",
    features: [
      "48 小时内交付",
      "免费修改 3 次",
      "4K 高清输出",
      "适配小红书 / 朋友圈 / 抖音",
    ],
    cta: "适合一次性需求",
    highlight: false,
  },
  {
    tier: "包月套餐",
    price: "¥ 599",
    cadence: "/ 月起",
    features: [
      "每月 20 张定制",
      "排期优先",
      "Prompt 模板沉淀",
      "可改文字图层 / PSD",
    ],
    cta: "推荐：博主 / 中小商家",
    highlight: true,
  },
  {
    tier: "长期合作",
    price: "面议",
    cadence: "",
    features: [
      "品牌视觉一致性",
      "专属 Prompt 库",
      "节日营销节点保障",
      "可签合同与 NDA",
    ],
    cta: "适合品牌方 / 机构",
    highlight: false,
  },
];

const SCENARIOS = [
  { title: "小红书博主", desc: "高点击封面、风格一致的 9:16 视觉" },
  { title: "餐饮 / 美业 / 教培商家", desc: "促销海报、节日营销、九宫格朋友圈" },
  { title: "电商卖家", desc: "主图 / 详情页配图 / 包装视觉" },
  { title: "自媒体 / 公众号", desc: "封面图、信息图、长图配图" },
];

export default function ServicesPage() {
  return (
    <>
      <SEO
        title="代做 / 定制 · 小红书封面 · 商家海报 · 人像写真"
        description="按需定制 GPT-Image 2 出图服务。48 小时交付，免费修改 3 次，4K 高清，已为 60+ 客户合作。单图 / 包月 / 长期合作三档可选。"
        path="/services"
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
            >
              {s.title}
            </span>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="container-narrow scroll-mt-20 py-12 sm:py-16">
        <h2 className="serif-display text-[24px] text-ink-50 sm:text-3xl">价格与套餐</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {PRICING.map((p) => (
            <div
              key={p.tier}
              className={
                "relative flex flex-col rounded-2xl border p-6 transition " +
                (p.highlight
                  ? "border-ember-500/40 bg-ember-500/[0.04] shadow-ember"
                  : "border-white/[0.08] bg-white/[0.02]")
              }
            >
              {p.highlight && (
                <span className="absolute right-4 top-4 rounded-full border border-ember-500/40 bg-ember-500/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ember-100">
                  推荐
                </span>
              )}
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-300">
                {p.tier}
              </p>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="serif-display text-3xl text-ink-50 sm:text-4xl">{p.price}</span>
                <span className="text-[12px] text-ink-400">{p.cadence}</span>
              </p>
              <ul className="mt-5 space-y-2 text-[13.5px] text-ink-200">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ember-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[12px] text-ink-400">{p.cta}</p>
              <a
                href="#wechat"
                className={
                  "mt-6 inline-flex items-center justify-center rounded-full px-4 py-2.5 text-[13px] font-semibold transition " +
                  (p.highlight
                    ? "bg-ember-500 text-ink-950 hover:bg-ember-400"
                    : "border border-white/10 bg-white/[0.03] text-ink-100 hover:border-white/25")
                }
              >
                微信咨询
              </a>
            </div>
          ))}
        </div>
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
                工作日 10:00–22:00 在线。把你的需求 / 参考图发给我，我会在 1 小时内反馈方向与报价。
              </p>
              <ul className="mt-5 grid gap-2 text-[13.5px] text-ink-200 sm:grid-cols-2">
                <li>· 不收顾问费 / 沟通成本</li>
                <li>· 仅在确认方向后开始计费</li>
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

      {/* CASES TEASER */}
      <section id="cases" className="container-narrow scroll-mt-20 pb-20">
        <h2 className="serif-display text-[22px] text-ink-50 sm:text-3xl">先看作品风格</h2>
        <p className="mt-2 text-[14px] text-ink-400">案例库里所有图都是真实出图。</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/category/xhs-cover" className="chip chip-idle">小红书封面</Link>
          <Link to="/category/merchant-poster" className="chip chip-idle">商家海报</Link>
          <Link to="/category/portrait" className="chip chip-idle">人像写真</Link>
          <Link to="/category/3d-ip" className="chip chip-idle">3D · IP 形象</Link>
          <Link to="/category/ecommerce" className="chip chip-idle">电商产品图</Link>
          <Link to="/cases" className="chip chip-active">全部案例 →</Link>
        </div>
      </section>
    </>
  );
}
