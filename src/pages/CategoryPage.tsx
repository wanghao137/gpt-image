import { useMemo, useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { casesByUserCategory, loadShard, getCachedShard } from "../lib/data";
import { getUserCategoryBySlug, USER_CATEGORIES } from "../lib/userCategories";
import type { PromptCase } from "../types";
import { CaseGrid } from "../components/CaseGrid";
import { SEO, SITE } from "../components/SEO";
import { BRAND } from "../lib/brand";
import { useFavorites } from "../hooks/useFavorites";
import { useCaseReturnRestore } from "../hooks/useCaseReturnRestore";
import NotFoundPage from "./NotFoundPage";

/**
 * /category/:slug — landing page for one user-intent bucket.
 *
 * SSG: pre-rendered for every slug in USER_CATEGORIES using the full dataset
 * (casesByUserCategory). The HTML contains the complete case grid.
 *
 * Client hydration: the client bundle tree-shakes ALL_CASES away (see
 * lib/data.ts), so the first client render has NO data. Without help it used
 * to render the EMPTY STATE over the baked 24-card wall → React #425/#418
 * hydration teardown on every direct category load. The SSG now serializes
 * the exact first-frame slice + total into the markup (data-payload below);
 * the client's first render reads it and hydrates 1:1, then the shard
 * (cases-<key>.json) upgrades the list after hydration.
 */
const BOOTSTRAP_PAGE_SIZE = 24;

function readBootstrapPayload(key: string | undefined):
  | { key: string; items: PromptCase[]; total: number }
  | null {
  if (typeof document === "undefined" || !key) return null;
  try {
    const el = document.getElementById(`cat-bootstrap-${key}`);
    if (!el?.getAttribute("data-payload")) return null;
    const parsed = JSON.parse(el.getAttribute("data-payload") || "null") as {
      key?: string;
      items?: PromptCase[];
      total?: number;
    } | null;
    if (parsed?.key !== key || !Array.isArray(parsed.items) || !parsed.items.length) return null;
    return {
      key: parsed.key,
      items: parsed.items,
      total: typeof parsed.total === "number" ? parsed.total : parsed.items.length,
    };
  } catch {
    return null;
  }
}

function placeholderCase(i: number): PromptCase {
  // Never rendered: they only pad `cases.length` so CaseGrid's remaining-count
  // math matches the SSG'd "还剩 N" / load-more button before the shard lands
  // (visibleCount stays at the first BOOTSTRAP_PAGE_SIZE real items).
  return {
    id: `category-pad-${i}`,
    slug: `category-pad-${i}`,
    title: "",
    imageUrl: "",
    ratio: "1:1",
    userCategory: "other",
    createdAt: "",
  } as PromptCase;
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const meta = slug ? getUserCategoryBySlug(slug) : undefined;
  const isSSR = import.meta.env.SSR;

  // SSG mode: casesByUserCategory returns the full list from ALL_CASES.
  // Client mode: returns []. We supplement with the shard on the client.
  const ssgList = useMemo(
    () => (meta ? casesByUserCategory(meta.key) : []),
    [meta],
  );

  // Read the SSG-serialized first frame ONCE per mount, before React touches
  // the server markup. Keyed by category so client-side navigation between
  // categories can't reuse the previous page's payload.
  const [bootstrap] = useState(() => readBootstrapPayload(meta?.key));
  const bootstrapForMeta =
    bootstrap && meta && bootstrap.key === meta.key ? bootstrap : null;

  // Client-side shard loading for hydration + interaction.
  const [clientList, setClientList] = useState<PromptCase[]>(() =>
    meta ? (getCachedShard(meta.key) ?? []) : [],
  );

  useEffect(() => {
    if (!meta) return;
    const cached = getCachedShard(meta.key);
    if (cached) {
      setClientList(cached);
      return;
    }
    let cancelled = false;
    loadShard(meta.key)
      .then((data) => {
        if (!cancelled) setClientList(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta]);

  // First client frame: the serialized SSG slice (+ invisible padding to the
  // true total, so the load-more button matches the baked HTML). Once the
  // shard arrives, switch to the client list for interaction.
  const list = useMemo(() => {
    if (isSSR) return ssgList;
    if (clientList.length > 0) return clientList;
    if (bootstrapForMeta) {
      const pad = Math.max(0, bootstrapForMeta.total - bootstrapForMeta.items.length);
      return pad > 0
        ? [...bootstrapForMeta.items, ...Array.from({ length: pad }, (_, i) => placeholderCase(i))]
        : bootstrapForMeta.items;
    }
    return [];
  }, [isSSR, ssgList, clientList, bootstrapForMeta]);

  // Display counts must agree between the baked HTML and the first client
  // render — the h1 reads this, so it tracks the payload total, not the slice.
  const totalCases = isSSR
    ? ssgList.length
    : clientList.length > 0
      ? clientList.length
      : bootstrapForMeta
        ? bootstrapForMeta.total
        : 0;

  // Direct loads render the real first frame; client-side navigation (no
  // payload) shows skeletons instead of a misleading "没有找到" empty state.
  const listLoading = !isSSR && clientList.length === 0 && !bootstrapForMeta;

  const { ids, toggle } = useFavorites();
  const { restoreId, onRestored } = useCaseReturnRestore();

  if (!meta) return <NotFoundPage />;

  const seoTitle = `${meta.label} · GPT-Image 2 案例与 Prompt`;
  const seoDesc = `${BRAND.name}整理 ${meta.label} GPT-Image 2 提示词案例 ${totalCases} 个。${meta.tagline}。中英双语 Prompt，一键复制就能出图。`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "案例", item: `${SITE.url}/cases` },
      {
        "@type": "ListItem",
        position: 3,
        name: meta.label,
        item: `${SITE.url}/category/${meta.slug}`,
      },
    ],
  };

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: seoTitle,
    description: seoDesc,
    inLanguage: "zh-CN",
    url: `${SITE.url}/category/${meta.slug}`,
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
  };

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDesc}
        path={`/category/${meta.slug}`}
        image={list[0]?.imageUrl}
        jsonLd={[breadcrumbLd, collectionLd]}
      />

      <section className="container-gallery pb-4 pt-10 sm:pt-14">
        <nav aria-label="面包屑" className="text-[12px] text-ink-500">
          <Link to="/" className="hover:text-ink-200">首页</Link>
          <span className="mx-2 text-ink-700">›</span>
          <Link to="/cases" className="hover:text-ink-200">案例</Link>
          <span className="mx-2 text-ink-700">›</span>
          <span className="text-ink-300">{meta.label}</span>
        </nav>

        <p className="eyebrow mt-6">Category</p>
        <h1 className="serif-display mt-2 text-[28px] text-ink-50 sm:text-4xl lg:text-[44px]">
          {meta.label}
          <span className="ml-3 align-middle text-[14px] font-medium tabular-nums text-ink-400 sm:text-[16px]">
            {totalCases} 个案例
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-300 sm:text-[15px]">
          {meta.tagline}。默认推荐比例 {meta.defaultRatio}。
        </p>

        {/* Sibling category nav */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/cases"
            className="chip chip-idle"
            aria-label="所有案例"
          >
            全部案例
          </Link>
          {USER_CATEGORIES.map((c) => {
            const isActive = c.key === meta.key;
            return (
              <Link
                key={c.slug}
                to={`/category/${c.slug}`}
                className={`chip ${isActive ? "chip-active" : "chip-idle"}`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="pt-6">
        {/* restoreId waits for the shard: before it lands, `cases` is the 24-item
            bootstrap slice + invisible padding, and a deep restore target would
            expand visibleCount INTO the padding. Once the shard is in, restores
            work exactly as on /cases. */}
        <CaseGrid
          cases={list}
          loading={listLoading}
          favoriteIds={ids}
          onToggleFavorite={toggle}
          priorityCount={4}
          restoreId={clientList.length ? restoreId : undefined}
          onRestored={onRestored}
        />
      </div>
      {/* SSR-only payload: the exact first-frame slice + total, so the client's
          first render hydrates 1:1 with the baked wall. The client re-renders
          this tag empty (suppressHydrationWarning) — it is read once in the
          state initializer, before React mutates the server markup. */}
      {isSSR && meta && (
        <script
          type="application/json"
          id={`cat-bootstrap-${meta.key}`}
          data-payload={JSON.stringify({
            key: meta.key,
            items: ssgList.slice(0, BOOTSTRAP_PAGE_SIZE),
            total: ssgList.length,
          })}
          hidden
        />
      )}
      {!isSSR && meta && (
        <script
          type="application/json"
          id={`cat-bootstrap-${meta.key}`}
          data-payload=""
          hidden
        />
      )}
    </>
  );
}
