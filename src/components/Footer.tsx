import { Link } from "react-router-dom";

/**
 * Site-wide footer. Surfaces:
 *   1. Brand promise — what this site is, in one sentence.
 *   2. Five secondary nav columns (cases / templates / guide / services / legal).
 *   3. Contact + WeChat CTA — the conversion entry point.
 */
export function Footer() {
  return (
    <footer className="mt-12 border-t border-white/[0.06] bg-ink-950/40">
      <div
        className="container-narrow grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]"
        style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom))" }}
      >
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-ember-300 via-ember-500 to-ember-700 text-[15px] font-bold text-ink-950 shadow-ember">
              <span className="serif-display leading-none">G</span>
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-ink-50">
              GPT-Image 2 中文案例库
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ink-400">
            真实案例 + 中英双语 Prompt + 一键复制。让小红书博主、商家与设计师从灵感到出图只走一步。
          </p>
          <p className="mt-4 text-[12px] text-ink-500">
            © {new Date().getFullYear()} GPT-Image 2 中文案例库 · 部分素材来源
            <a
              className="ml-1 underline-offset-2 hover:text-ink-200 hover:underline"
              href="https://github.com/freestylefly/awesome-gpt-image-2"
              target="_blank"
              rel="noreferrer"
            >
              awesome-gpt-image-2
            </a>
          </p>
        </div>

        <FooterCol title="案例">
          <Link to="/cases" className="footer-link">全部案例</Link>
          <Link to="/category/xhs-cover" className="footer-link">小红书封面</Link>
          <Link to="/category/merchant-poster" className="footer-link">商家海报</Link>
          <Link to="/category/portrait" className="footer-link">人像写真</Link>
          <Link to="/category/3d-ip" className="footer-link">3D · IP 形象</Link>
        </FooterCol>

        <FooterCol title="模板与教程">
          <Link to="/templates" className="footer-link">工业级模板</Link>
          <Link to="/guide" className="footer-link">新手教程</Link>
          <Link to="/agents" className="footer-link">Agent 技能</Link>
        </FooterCol>

        <FooterCol title="服务">
          <Link to="/services" className="footer-link font-medium text-ember-300 hover:text-ember-200">
            代做 / 定制 ▸
          </Link>
          <Link to="/services#pricing" className="footer-link">价格说明</Link>
          <Link to="/services#cases" className="footer-link">客户案例</Link>
          <Link to="/about" className="footer-link">关于我</Link>
        </FooterCol>

        <FooterCol title="联系">
          <a className="footer-link" href="#wechat">微信咨询</a>
          <a
            className="footer-link"
            href="https://github.com/freestylefly/awesome-gpt-image-2"
            target="_blank"
            rel="noreferrer"
          >
            GitHub 数据源
          </a>
          <a className="footer-link" href="/sitemap.xml">站点地图</a>
        </FooterCol>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-300">
        {title}
      </h4>
      <ul className="flex flex-col gap-2 text-[13px]">
        {Array.isArray(children)
          ? children.map((child, i) => <li key={i}>{child}</li>)
          : <li>{children}</li>}
      </ul>
    </div>
  );
}
