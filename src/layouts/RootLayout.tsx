import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { BackToTop } from "../components/BackToTop";
import { ToastViewport } from "../components/Toast";
import { caseReturnPath, readCaseReturn } from "../lib/caseReturn";

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

  return (
    <div id="top" className="min-h-full overflow-x-hidden font-sans text-ink-100">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
      <ToastViewport />
    </div>
  );
}
