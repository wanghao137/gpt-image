import { Link } from "react-router-dom";

/**
 * Site-wide footer. Surfaces:
 *   1. Brand promise — what this site is, in one sentence.
 *   2. A quick chip row to the 5 most-used category landing pages.
 *   3. Five secondary nav columns. On mobile each column is a <details>
 *      panel collapsed by default; on sm+ they expand into the original
 *      five-column grid with no collapse affordance. SEO is preserved
 *      because the link DOM lives inside <details>, just visually hidden.
 *   4. Contact + WeChat CTA — the conversion entry point.
 *
 * Mobile height before this rewrite: ~1100px (5 stacked columns).
 * After: ~400px collapsed, ~1100px fully expanded — but expansion is
 * intentional, only on the section the user actually wants to see.
 */
export function Footer() {
  return (
    <footer className="mt-12 border-t border-white/[0.06] bg-ink-950/40">
      <div
        className="container-narrow flex flex-col gap-8 py-10 md:gap-10 md:py-12"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Brand row + quick chips. On desktop these collapse into a
            standalone "brand column" inside the grid; on mobile they sit
            on their own at the top above the accordion. */}
        <div className="flex flex-col gap-6 md:hidden">
          <BrandBlock />
          <QuickChips />
        </div>

        {/* Desktop 5-col grid. Hidden on mobile. */}
        <div className="hidden gap-10 md:grid md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <BrandBlock />
          {COLUMNS.map((col) => (
            <DesktopCol key={col.title} title={col.title}>
              {col.links.map((l) => renderLink(l))}
            </DesktopCol>
          ))}
        </div>

        {/* Mobile accordion. Hidden on desktop. */}
        <ul className="flex flex-col divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] md:hidden">
          {COLUMNS.map((col) => (
            <li key={col.title}>
              <MobileCol title={col.title}>
                {col.links.map((l) => renderLink(l, "mobile"))}
              </MobileCol>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}

// ──────────────────────────────────────────── columns / chips data ─

interface FooterLink {
  to?: string;
  href?: string;
  external?: boolean;
  label: string;
  /** When true, renders the link in the ember accent colour. */
  accent?: boolean;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: "案例",
    links: [
      { to: "/cases", label: "全部案例" },
      { to: "/category/xhs-cover", label: "小红书封面" },
      { to: "/category/merchant-poster", label: "商家海报" },
      { to: "/category/portrait", label: "人像写真" },
      { to: "/category/3d-ip", label: "3D · IP 形象" },
    ],
  },
  {
    title: "模板与教程",
    links: [
      { to: "/templates", label: "工业级模板" },
      { to: "/guide", label: "新手教程" },
      { to: "/agents", label: "Agent 技能" },
    ],
  },
  {
    title: "服务",
    links: [
      { to: "/services", label: "代做 / 定制 ▸", accent: true },
      { to: "/services#faq", label: "合作流程" },
      { to: "/services#cases", label: "客户案例" },
      { to: "/about", label: "关于我" },
    ],
  },
  {
    title: "联系",
    links: [
      { href: "#wechat", label: "微信咨询" },
      {
        href: "https://github.com/freestylefly/awesome-gpt-image-2",
        external: true,
        label: "GitHub 数据源",
      },
      { href: "/sitemap.xml", label: "站点地图" },
    ],
  },
];

const QUICK_CHIPS: { to: string; label: string; primary?: boolean }[] = [
  { to: "/category/xhs-cover", label: "小红书封面" },
  { to: "/category/merchant-poster", label: "商家海报" },
  { to: "/category/portrait", label: "人像写真" },
  { to: "/category/3d-ip", label: "3D · IP" },
  { to: "/cases", label: "全部案例 →", primary: true },
];

// ───────────────────────────────────────────────────── small atoms ─

function BrandBlock() {
  return (
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
          className="ml-1 underline-offset-2 hover:text-ink-300 hover:underline"
          href="https://github.com/freestylefly/awesome-gpt-image-2"
          target="_blank"
          rel="noreferrer"
        >
          awesome-gpt-image-2
        </a>
      </p>
    </div>
  );
}

/**
 * Mobile-only quick chip row. Mirrors the sticky category strip from
 * /cases so the "browse by scenario" affordance is reachable without
 * expanding any accordion. Horizontally scrollable with edge mask.
 */
function QuickChips() {
  return (
    <div className="-mx-5 mask-fade-x">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin px-5">
        {QUICK_CHIPS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className={
              "shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition " +
              (c.primary
                ? "border-ember-500/60 bg-ember-500/15 text-ember-100"
                : "border-white/10 bg-white/[0.03] text-ink-200 hover:border-white/25 hover:text-ink-50")
            }
          >
            {c.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function DesktopCol({ title, children }: { title: string; children: React.ReactNode }) {
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

/**
 * Mobile column rendered as a <details> panel. Uses the native disclosure
 * widget — keyboard accessible, screen-reader announces "expanded /
 * collapsed", no JS state required. The +/- pivot uses CSS rotation
 * driven by the `[open]` selector.
 */
function MobileCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[13.5px] font-semibold text-ink-100 marker:hidden">
        <span>{title}</span>
        <span
          aria-hidden="true"
          className="grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[14px] leading-none text-ink-400 transition group-open:rotate-45 group-open:border-ember-500/40 group-open:bg-ember-500/15 group-open:text-ember-200"
        >
          +
        </span>
      </summary>
      <ul className="flex flex-col gap-1 px-4 pb-4 pt-1 text-[13.5px]">
        {Array.isArray(children)
          ? children.map((child, i) => <li key={i}>{child}</li>)
          : <li>{children}</li>}
      </ul>
    </details>
  );
}

/**
 * Render either a react-router Link (internal) or a regular <a> (external /
 * hash). The mobile variant gets slightly larger row height for thumb-friendly
 * tap targets — desktop stays compact since it's a hover/click context.
 */
function renderLink(link: FooterLink, variant: "desktop" | "mobile" = "desktop") {
  const baseClassName =
    variant === "mobile"
      ? "block py-1.5 text-ink-300 transition hover:text-ink-50"
      : "footer-link";
  const accentClassName = link.accent
    ? variant === "mobile"
      ? "font-semibold text-ember-300 hover:text-ember-200"
      : "font-medium text-ember-300 hover:text-ember-200"
    : "";
  const className = `${baseClassName} ${accentClassName}`.trim();

  if (link.to) {
    return (
      <Link key={link.label} to={link.to} className={className}>
        {link.label}
      </Link>
    );
  }
  if (link.href) {
    return (
      <a
        key={link.label}
        href={link.href}
        className={className}
        target={link.external ? "_blank" : undefined}
        rel={link.external ? "noreferrer" : undefined}
      >
        {link.label}
      </a>
    );
  }
  return null;
}
