import { Link } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { BRAND } from "../lib/brand";
import { USER_CATEGORIES } from "../lib/userCategories";

/**
 * Site-wide footer. Surfaces:
 *   1. Brand promise — what this site is, in one sentence.
 *   2. A quick chip row to the most-used category landing pages.
 *   3. Three secondary nav columns. On mobile each column is a <details>
 *      panel collapsed by default; on sm+ they expand into a 4-col grid
 *      (brand + 3 link columns) with no collapse affordance.
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

        {/* Desktop 4-col grid. Hidden on mobile. */}
        <div className="hidden gap-10 md:grid md:grid-cols-[1.6fr_1fr_1fr_1fr]">
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

// Footer showcases a curated subset of high-conversion categories. The slug
// keys are sourced from `USER_CATEGORIES` (single source of truth) so a slug
// rename can never silently 404 the footer — `cat(slug)` throws at build time
// if a slug disappears. Labels come straight from the category table too, so
// the footer never drifts out of sync with the category landing pages.
const FOOTER_CATEGORY_SLUGS = ["xhs-cover", "merchant-poster", "portrait", "3d-ip"] as const;

function cat(slug: string): { to: string; label: string } {
  const meta = USER_CATEGORIES.find((c) => c.slug === slug);
  if (!meta) throw new Error(`Footer references unknown category slug "${slug}"`);
  return { to: `/category/${meta.slug}`, label: meta.label };
}

const FOOTER_CATEGORIES = FOOTER_CATEGORY_SLUGS.map(cat);

const COLUMNS: FooterColumn[] = [
  {
    title: "案例",
    links: [{ to: "/cases", label: "全部案例" }, ...FOOTER_CATEGORIES],
  },
  {
    title: "模板与工具",
    links: [
      { to: "/templates", label: "工业级模板" },
    ],
  },
  {
    title: "其他",
    links: [
      { to: "/about", label: "关于" },
      { to: "/about#sources", label: "来源与授权" },
      { to: "/about#privacy", label: "隐私说明" },
      {
        href: "https://github.com/YouMind-OpenLab/gpt-image-2-prompts-search",
        external: true,
        label: "GitHub 数据源",
      },
      { to: "/sitemap", label: "站点地图" },
    ],
  },
];

const QUICK_CHIPS: { to: string; label: string; primary?: boolean }[] = [
  ...FOOTER_CATEGORIES,
  { to: "/cases", label: "全部案例 →", primary: true },
];

// ───────────────────────────────────────────────────── small atoms ─

function BrandBlock() {
  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-2.5">
        <BrandLogo
          markClassName="h-10 w-10 drop-shadow-[0_16px_32px_rgba(255,107,107,0.22)]"
          showEnglish
        />
      </Link>
      <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ink-400">
        {BRAND.name}整理真实案例、Prompt 模板与场景分类。让小红书博主、商家与设计师从灵感到出图只走一步。
      </p>
      <p className="mt-4 text-[12px] text-ink-500">
        © {new Date().getFullYear()} {BRAND.name} · 部分素材来源
        <a
          className="ml-1 underline-offset-2 hover:text-ink-300 hover:underline"
          href="https://github.com/YouMind-OpenLab/gpt-image-2-prompts-search"
          target="_blank"
          rel="noreferrer"
        >
          {BRAND.sourceCredit}
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
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition " +
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
      ? "flex min-h-11 items-center py-2 text-ink-300 transition hover:text-ink-50"
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
