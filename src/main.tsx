import "./index.css";
import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "./routes";

/**
 * SSG-aware entry. `vite-react-ssg` builds in two phases:
 *   1. Server: walks `routes` and renders each page to static HTML.
 *   2. Client: hydrates the same tree at runtime with react-router.
 *
 * Both code paths use the same `routes` table — no separate dev/prod entry.
 */
export const createRoot = ViteReactSSG(
  { routes, basename: "/" },
  // Runs on both server and client. On the client we dismiss the boot overlay
  // the moment hydration is underway — the SSG'd HTML is already painted, so
  // the overlay is purely a brand handoff and should not outlive interactivity.
  ({ isClient }) => {
    if (isClient && typeof window !== "undefined") {
      requestAnimationFrame(() => {
        (window as unknown as { __dismissBoot?: () => void }).__dismissBoot?.();
      });
    }
  },
);
