import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";

export default function NotFoundPage() {
  return (
    <>
      <SEO
        title="页面不存在 · GPT-Image 2 中文案例库"
        description="你访问的页面不存在或已下架。回到首页继续浏览 435+ 个 GPT-Image 2 案例。"
        path="/404"
        noindex
      />
      <section className="container-narrow grid place-items-center py-24 text-center">
        <p className="eyebrow">404</p>
        <h1 className="serif-display mt-3 text-[32px] text-ink-50 sm:text-5xl">
          这里没有你找的页面。
        </h1>
        <p className="mt-3 max-w-md text-[14px] text-ink-400">
          也许是链接过时了。回到首页或案例库继续浏览。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn-primary">
            回首页
          </Link>
          <Link to="/cases" className="btn-ghost">
            浏览案例
          </Link>
        </div>
      </section>
    </>
  );
}
