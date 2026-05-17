import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { BackToTop } from "../components/BackToTop";

/**
 * Wraps every route. Lives outside individual pages so that:
 *   - The header/footer DOM is stable across SPA navigation (no re-mount).
 *   - Per-page <SEO> tags can replace head atoms cleanly.
 *   - Scroll resets at the top on every navigation, except for in-page anchors.
 */
export default function RootLayout() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) return; // let anchor scroll do its job
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.pathname]);

  return (
    <div id="top" className="min-h-full overflow-x-hidden font-sans text-ink-100">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}
