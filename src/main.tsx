import "./index.css";
import { createRoot as createClientRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ViteReactSSG } from "vite-react-ssg";
import { installStaticLoaderManifestGuard } from "./lib/static-loader-manifest-core.mjs";
import { routes } from "./routes";

/**
 * SSG-aware entry. `vite-react-ssg` builds in two phases:
 *   1. Server: walks `routes` and renders each page to static HTML.
 *   2. Client: hydrates the same tree at runtime with react-router.
 *
 * Both code paths use the same `routes` table — no separate dev/prod entry.
 */
installStaticLoaderManifestGuard();

function mountClientOnlyApp() {
  const container = document.getElementById("root");
  if (!container) throw new Error("Root container not found");

  const router = createBrowserRouter(routes, { basename: "/" });
  createClientRoot(container).render(
    <HelmetProvider>
      <RouterProvider router={router} />
    </HelmetProvider>,
  );
}

const isClientOnlyShell =
  typeof document !== "undefined" && document.querySelector("[data-server-rendered=true]") === null;

export const createRoot = isClientOnlyShell
  ? mountClientOnlyApp()
  : ViteReactSSG({ routes, basename: "/" });
