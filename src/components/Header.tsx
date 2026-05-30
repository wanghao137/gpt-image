import { memo, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import {
  applyThemeToDocument,
  getSystemTheme,
  parseThemeMode,
  resolveEffectiveTheme,
  THEME_KEY,
} from "../lib/theme";
import { BRAND } from "../lib/brand";
import type { EffectiveTheme, ThemeMode } from "../lib/theme";

interface NavItem {
  to: string;
  label: string;
  /** When true, the link gets the ember accent treatment. */
  accent?: boolean;
}

function initialThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    return parseThemeMode(window.localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

const NAV: NavItem[] = [
  { to: "/cases", label: "案例" },
  { to: "/templates", label: "模板" },
  { to: "/about", label: "关于" },
];

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string }> = [
  { mode: "light", label: "浅色" },
  { mode: "dark", label: "深色" },
  { mode: "system", label: "系统" },
];

function HeaderImpl() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // IMPORTANT (hydration): the server/SSG render has no localStorage or
  // matchMedia, so it always produces themeMode="system" + systemTheme="dark".
  // If the client read localStorage during the FIRST render, the theme toggle
  // icons (sun/moon <circle>) would differ from the server markup and React
  // would throw a hydration mismatch, then fall back to full client rendering
  // for the WHOLE app — silently destroying the SSG benefit. So we deliberately
  // start from the same values the server used and only adopt the persisted
  // mode + real system theme in an effect, after hydration has committed.
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>("dark");
  const [themeHydrated, setThemeHydrated] = useState(false);
  // Nav active-state gate. react-router's <NavLink> derives `aria-current` from
  // the router location. Under vite-react-ssg the client router's FIRST render
  // can briefly resolve a different location than the SSG used, so the baked
  // `aria-current="page"` didn't match the client's first render — React threw
  // a hydration error and re-rendered the WHOLE app on the client (a big
  // weak-network regression, and it defeats the SSG). We render nav links
  // INACTIVE on the server and the first client render (deterministically
  // identical), then enable active styling after mount. The highlight appears a
  // frame later but hydration stays intact.
  const [navMounted, setNavMounted] = useState(false);
  const location = useLocation();
  const effectiveTheme = resolveEffectiveTheme(themeMode, systemTheme);
  const currentPath = location.pathname;
  const isNavActive = (to: string) =>
    navMounted && (currentPath === to || currentPath.startsWith(`${to}/`));

  useEffect(() => {
    setNavMounted(true);
  }, []);

  // Adopt the persisted theme mode + real system theme once, after the first
  // client render. The inline script in index.html already applied the correct
  // `data-theme` to <html> pre-paint, so there's no visible flash.
  useEffect(() => {
    setThemeMode(initialThemeMode());
    setSystemTheme(getSystemTheme());
    setThemeHydrated(true);
  }, []);

  useEffect(() => {
    // Don't touch the document until we've adopted the persisted values —
    // otherwise the first commit (themeMode="system"/systemTheme="dark") would
    // briefly force dark on a light-theme client, fighting the inline script.
    if (!themeHydrated) return;
    applyThemeToDocument(effectiveTheme);
    try {
      window.localStorage.setItem(THEME_KEY, themeMode);
    } catch {
      return;
    }
  }, [themeHydrated, effectiveTheme, themeMode]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setSystemTheme(getSystemTheme());
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

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
          className="group inline-flex min-w-0 items-center"
          aria-label={BRAND.name}
        >
          <BrandLogo
            className="transition group-hover:scale-[1.02]"
            markClassName="h-9 w-9 drop-shadow-[0_14px_26px_rgba(255,107,107,0.25)]"
            textClassName="hidden max-w-[9rem] sm:block md:max-w-none"
          />
        </Link>

        <nav className="hidden items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.03] p-1 text-sm shadow-inner backdrop-blur md:flex">
          {NAV.map((n) => {
            const active = isNavActive(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active ? "page" : undefined}
                className={
                  "relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition " +
                  (n.accent
                    ? active
                      ? "bg-ember-500/20 text-ember-100"
                      : "text-ember-300 hover:bg-ember-500/10 hover:text-ember-200"
                    : active
                      ? "bg-white/10 text-ink-50"
                      : "text-ink-300 hover:text-ink-50")
                }
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div
            className="inline-flex h-9 items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-[12px] font-medium text-ink-300 shadow-inner backdrop-blur"
            role="radiogroup"
            aria-label="颜色模式"
          >
            {THEME_OPTIONS.map((option) => {
              const active = themeMode === option.mode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setThemeMode(option.mode)}
                  className={
                    "inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2 transition sm:px-2.5 " +
                    (active
                      ? "bg-white/[0.12] text-ink-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                      : "text-ink-400 hover:bg-white/[0.05] hover:text-ink-100")
                  }
                  aria-label={`切换${option.label}模式`}
                >
                  <ThemeIcon mode={option.mode} effectiveTheme={effectiveTheme} />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              );
            })}
          </div>
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
            {NAV.map((n) => {
              const active = isNavActive(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-current={active ? "page" : undefined}
                  className={
                    "rounded-xl px-4 py-3 text-[15px] font-medium transition " +
                    (n.accent
                      ? "bg-ember-500/10 text-ember-200"
                      : active
                        ? "bg-white/[0.06] text-ink-50"
                        : "text-ink-200 hover:bg-white/[0.04]")
                  }
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

function ThemeIcon({
  mode,
  effectiveTheme,
}: {
  mode: ThemeMode;
  effectiveTheme: EffectiveTheme;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      {mode === "light" ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </>
      ) : mode === "dark" ? (
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" />
      ) : (
        <>
          <rect x="3" y="4" width="18" height="13" rx="2.5" />
          <path d="M8 21h8M12 17v4" />
          {effectiveTheme === "light" ? (
            <circle cx="17" cy="8" r="1.5" />
          ) : (
            <path d="M18.5 8.7A2.6 2.6 0 1 1 15.3 5.5 2.2 2.2 0 0 0 18.5 8.7Z" />
          )}
        </>
      )}
    </svg>
  );
}

export const Header = memo(HeaderImpl);
