import type { RouteRecord } from "vite-react-ssg";
import RootLayout from "./layouts/RootLayout";
import HomePage from "./pages/HomePage";
import CasesPage from "./pages/CasesPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import CategoryPage from "./pages/CategoryPage";
import TemplatesPage from "./pages/TemplatesPage";
import GuidePage from "./pages/GuidePage";
import ServicesPage from "./pages/ServicesPage";
import AboutPage from "./pages/AboutPage";
import AgentsPage from "./pages/AgentsPage";
import NotFoundPage from "./pages/NotFoundPage";
import { ALL_CASES } from "./lib/data";
import { USER_CATEGORIES } from "./lib/userCategories";

/**
 * Route table consumed by `vite-react-ssg` at build time *and* by
 * `react-router-dom` at runtime. The `entry` field is what tells SSG which
 * URLs to pre-render — we expand it to every case slug + every category slug
 * so the build emits one HTML file per page.
 */
export const routes: RouteRecord[] = [
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage, entry: "src/pages/HomePage.tsx" },
      { path: "cases", Component: CasesPage, entry: "src/pages/CasesPage.tsx" },
      {
        path: "case/:slug",
        Component: CaseDetailPage,
        entry: "src/pages/CaseDetailPage.tsx",
        getStaticPaths: () => ALL_CASES.map((c) => `/case/${c.slug}`),
      },
      {
        path: "category/:slug",
        Component: CategoryPage,
        entry: "src/pages/CategoryPage.tsx",
        getStaticPaths: () => USER_CATEGORIES.map((c) => `/category/${c.slug}`),
      },
      { path: "templates", Component: TemplatesPage, entry: "src/pages/TemplatesPage.tsx" },
      { path: "guide", Component: GuidePage, entry: "src/pages/GuidePage.tsx" },
      { path: "services", Component: ServicesPage, entry: "src/pages/ServicesPage.tsx" },
      { path: "about", Component: AboutPage, entry: "src/pages/AboutPage.tsx" },
      { path: "agents", Component: AgentsPage, entry: "src/pages/AgentsPage.tsx" },
      { path: "*", Component: NotFoundPage },
    ],
  },
];
