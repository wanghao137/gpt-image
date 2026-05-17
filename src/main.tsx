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
  // SSG-side hook: warmed once per page, useful for analytics etc.
  () => {
    /* noop for now */
  },
);
