import { Link } from "react-router-dom";

/**
 * Conversion CTA used at the bottom of the home page and inside every case
 * detail. Three jobs:
 *   1. Make it obvious there's a real person behind the gallery.
 *   2. Set price expectations (anchor + 48h delivery).
 *   3. Single, unambiguous next step → /services.
 */
interface WeChatCTAProps {
  /** Optional contextual lead — e.g. the case title we're up-selling around. */
  context?: string;
  variant?: "default" | "compact";
}

export function WeChatCTA({ context, variant = "default" }: WeChatCTAProps) {
  if (variant === "compact") {
    return (
      <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-ink-50">
            {context ? `想要类似「${context}」的定制？` : "想要类似的定制图？"}
          </p>
          <p className="mt-1 text-[12.5px] text-ink-400">
            48 小时交付 · 免费修改 3 次 · 60+ 客户合作
          </p>
        </div>
        <Link
          to="/services"
          className="btn-primary justify-center sm:justify-start"
        >
          看报价 / 加微信
        </Link>
      </div>
    );
  }

  return (
    <section className="container-narrow py-14 sm:py-20">
      <div className="surface relative overflow-hidden p-7 sm:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full bg-ember-500/15 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-ember-700/15 blur-[100px]"
        />

        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="eyebrow">Get yours · 定制服务</p>
            <h2 className="serif-display mt-3 text-[28px] leading-[1.1] text-ink-50 sm:text-4xl lg:text-[42px]">
              {context
                ? `这种风格我能帮你定制 →`
                : `小红书封面 / 商家海报 / 人像写真，按需定制`}
            </h2>
            <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink-300 sm:text-[15px]">
              站内案例只是冰山一角。我能根据你的品牌、产品、活动定制专属 GPT-Image 2 出图，
              48 小时内交付，免费修改 3 次。已为 60+ 小红书博主与商家合作出图。
            </p>

            <ul className="mt-6 grid gap-2 text-[13.5px] text-ink-200 sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-ember-400" />
                单图 / 包月 / 长期合作三档
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-ember-400" />
                4K 高清 + 可改文字图层
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-ember-400" />
                适配小红书 / 朋友圈 / 抖音 / 电商
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-ember-400" />
                可附身份垫图保持一致性
              </li>
            </ul>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/services" className="btn-primary">
                查看报价与作品集
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 0 1 .75-.75h10.69l-3.97-3.97a.75.75 0 1 1 1.06-1.06l5.25 5.25c.3.3.3.77 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H3.75A.75.75 0 0 1 3 10Z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
              <Link to="/about" className="btn-ghost">关于我</Link>
            </div>
          </div>

          <div className="relative">
            <div className="surface relative mx-auto max-w-sm p-6 text-center">
              <div className="grid place-items-center">
                <div className="grid h-44 w-44 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500">
                  扫码 · 占位
                </div>
              </div>
              <p className="mt-4 text-[13px] font-semibold text-ink-100">微信扫码 · 直接对话</p>
              <p className="mt-1 text-[12px] text-ink-500">工作日 10:00–22:00 / 备注「来自 Gallery」</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
