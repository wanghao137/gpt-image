import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { BackToTop } from "../components/BackToTop";
import { Observability } from "../components/Observability";
import { ToastViewport } from "../components/Toast";
import { caseReturnPath, readCaseReturn } from "../lib/caseReturn";
import { routeAnnouncement } from "../lib/route-accessibility.mjs";

/**
 * Wraps every route. Lives outside individual pages so that:
 *   - The header/footer DOM is stable across SPA navigation (no re-mount).
 *   - Per-page <SEO> tags can replace head atoms cleanly.
 *   - Scroll resets at the top on every navigation, except for in-page anchors.
 *   - One ToastViewport mounts at the root — anywhere in the app can fire
 *     toasts via `toast.success(...)` without prop-drilling.
 */
export default function RootLayout() {
  const location = useLocation();
  const firstRouteRef = useRef(true);
  const previousPathRef = useRef(location.pathname);
  const [routeStatus, setRouteStatus] = useState("");
  const currentRoutePath = caseReturnPath(location);

  useEffect(() => {
    if (typeof window === "undefined" || !("scrollRestoration" in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    if (location.hash) return; // let anchor scroll do its job
    if (typeof window === "undefined") return;
    const target = readCaseReturn();
    if (target?.path === caseReturnPath(location)) return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);

  useEffect(() => {
    if (firstRouteRef.current) {
      firstRouteRef.current = false;
      return;
    }
    const pathChanged = previousPathRef.current !== location.pathname;
    previousPathRef.current = location.pathname;
    if (!pathChanged) return;
    if (location.hash || typeof document === "undefined") return;
    const target = readCaseReturn();
    if (target?.path === currentRoutePath) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("main")?.focus({ preventScroll: true });
      setRouteStatus(`${routeAnnouncement(location.pathname)}：${document.title}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.hash, currentRoutePath]);

  return (
    <div id="top" className="min-h-full overflow-x-hidden font-sans text-ink-100">
      {/*
        Skip-link: visually hidden until focused. Lets keyboard / screen-reader
        users jump straight to the main content past the header nav — a WCAG
        2.4.1 requirement. `#main` matches the id on <main> below; the main
        element is also focusable (tabIndex -1) so the focus actually moves
        there rather than just scrolling.
      */}
      <a href="#main" className="skip-link">
        跳到主内容
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <p id="route-announcer" className="sr-only" aria-live="polite" aria-atomic="true">
        {routeStatus}
      </p>
      <Footer />
      <BackToTop />
      <ToastViewport />
      <Observability />
    </div>
  );
}
