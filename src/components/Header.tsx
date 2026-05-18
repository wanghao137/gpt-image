import { memo, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  /** When true, the link gets the ember accent treatment. */
  accent?: boolean;
}

const NAV: NavItem[] = [
  { to: "/cases", label: "案例" },
  { to: "/templates", label: "模板" },
  { to: "/guide", label: "教程" },
  { to: "/services", label: "服务定制", accent: true },
  { to: "/about", label: "关于" },
];

function HeaderImpl() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when drawer open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <header
      className={
        "sticky top-0 z-40 transition-all duration-500 " +
        (scrolled || mobileOpen
          ? "border-b border-white/[0.06] bg-ink-950/72 backdrop-blur-xl backdrop-saturate-150"
          : "border-b border-transparent bg-transparent")
      }
      // Respect notch / Dynamic Island. `viewport-fit=cover` is set in
      // index.html, but without honouring `safe-area-inset-top` the header
      // logo is partially obscured on iPhone 14+.
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="container-narrow flex h-16 items-center justify-between gap-4">
        <Link
          to="/"
          className="group inline-flex items-center gap-2.5"
          aria-label="GPT-Image 2 中文案例库"
        >
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-ember-300 via-ember-500 to-ember-700 text-[15px] font-bold text-ink-950 shadow-ember transition group-hover:scale-105">
            <span className="serif-display leading-none">G</span>
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-ember-200 ring-2 ring-ink-950" />
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-ink-50 sm:block">
            <span className="text-ink-300">GPT-Image 2</span>
            <span className="mx-1.5 text-ink-500">·</span>
            <span>案例库</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.03] p-1 text-sm shadow-inner backdrop-blur md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                "relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition " +
                (n.accent
                  ? isActive
                    ? "bg-ember-500/20 text-ember-100"
                    : "text-ember-300 hover:bg-ember-500/10 hover:text-ember-200"
                  : isActive
                    ? "bg-white/10 text-ink-50"
                    : "text-ink-300 hover:text-ink-50")
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/services"
            className="hidden h-9 items-center gap-1.5 rounded-full bg-ember-500 px-4 text-[13px] font-semibold text-ink-950 transition hover:bg-ember-400 sm:inline-flex"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M9.5 7.5c-1.4.7-2.5 2-2.5 3.5 0 .8.3 1.5.8 2.1l-.7 2 2.1-.7c.6.3 1.3.5 2 .5 2.2 0 4-1.6 4-3.5S13.4 7.5 11.2 7.5h-1.7Zm1 .9c1.6 0 2.9 1.2 2.9 2.6 0 1.4-1.3 2.6-2.9 2.6-.6 0-1.2-.2-1.7-.5l-1 .3.3-.9a2.6 2.6 0 0 1-.6-1.5c0-1.4 1.3-2.6 3-2.6Z" />
              <path
                fillRule="evenodd"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z"
                clipRule="evenodd"
              />
            </svg>
            微信咨询
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ink-200 md:hidden"
            aria-label="打开菜单"
            aria-expanded={mobileOpen}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              {mobileOpen ? (
                <path d="m18 6-12 12M6 6l12 12" />
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          className="border-t border-white/[0.06] bg-ink-950/95 backdrop-blur-xl md:hidden"
          aria-label="移动端导航"
        >
          <div className="container-narrow flex flex-col gap-1 py-4">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  "rounded-xl px-4 py-3 text-[15px] font-medium transition " +
                  (n.accent
                    ? "bg-ember-500/10 text-ember-200"
                    : isActive
                      ? "bg-white/[0.06] text-ink-50"
                      : "text-ink-200 hover:bg-white/[0.04]")
                }
              >
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

export const Header = memo(HeaderImpl);
