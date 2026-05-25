import assert from "node:assert/strict";
import test from "node:test";
import {
  TARGET_TEMPLATE_COUNT,
  deriveTemplatesFromCases,
  enrichUpstreamTemplate,
  getTemplateDerivationBase,
  mergeTemplateCollections,
} from "./template-derivation.mjs";

const SOURCE_URL =
  "https://cdn.jsdelivr.net/gh/freestylefly/awesome-gpt-image-2@main/data/style-library.json";
const DERIVED_SOURCE_URL = "/data/cases.json";

function template(id, extra = {}) {
  return {
    id,
    title: `Template ${id}`,
    category: "海报与排版",
    tags: ["Poster"],
    description: `Description ${id}`,
    cover: `/images/${id}.jpg`,
    prompt: `Prompt ${id}`,
    useWhen: `Use ${id}`,
    ...extra,
  };
}

function caseItem(id, userCategory, extra = {}) {
  return {
    id: String(id),
    title: `${userCategory} case ${id}`,
    category: "海报与排版",
    tags: [userCategory],
    styles: ["Commercial"],
    scenes: ["Campaign"],
    userCategory,
    userCategories: [],
    platforms: ["wechat"],
    imageUrl: `/images/case${id}.jpg`,
    imageAlt: `${userCategory} image`,
    promptPreview: `Create a polished ${userCategory} visual with clear hierarchy and production details.`,
    ratio: "4:5",
    difficulty: 2,
    commercialOk: "ask",
    createdAt: "2026-01-01T00:00:00.000Z",
    seoTitle: `${userCategory} seo`,
    seoDescription: `${userCategory} seo description`,
    ...extra,
  };
}

test("enrichUpstreamTemplate adds stable upstream source metadata", () => {
  const result = enrichUpstreamTemplate(template("poster-layout-system"), SOURCE_URL);

  assert.equal(result.sourceType, "upstream-style");
  assert.equal(result.sourceLabel, "awesome-gpt-image-2 · style-library");
  assert.equal(result.sourceUrl, SOURCE_URL);
  assert.equal(result.id, "poster-layout-system");
});

test("deriveTemplatesFromCases fills upstream templates to the target count", () => {
  const upstreamTemplates = Array.from({ length: 22 }, (_, index) =>
    template(`upstream-${index + 1}`),
  );
  const cases = [
    caseItem(1, "xhs-cover"),
    caseItem(2, "merchant-poster"),
    caseItem(3, "ecommerce"),
    caseItem(4, "portrait"),
    caseItem(5, "travel-poster"),
    caseItem(6, "festival"),
    caseItem(7, "wechat-grid"),
    caseItem(8, "sticker"),
    caseItem(9, "kids-portrait"),
    caseItem(10, "3d-ip"),
    caseItem(11, "brand-kv"),
    caseItem(12, "storyboard"),
    caseItem(13, "architecture"),
    caseItem(14, "document-publishing", {
      category: "文档与出版",
      userCategory: "other",
      tags: ["document", "publishing"],
    }),
  ];

  const derived = deriveTemplatesFromCases(cases, upstreamTemplates, {
    sourceUrl: DERIVED_SOURCE_URL,
  });
  const merged = mergeTemplateCollections({
    upstreamTemplates,
    derivedTemplates: derived,
    manualTemplates: [],
  });

  assert.equal(merged.length, TARGET_TEMPLATE_COUNT);
  assert.equal(derived.length, TARGET_TEMPLATE_COUNT - upstreamTemplates.length);
  assert.ok(derived.every((item) => item.sourceType === "derived-case"));
  assert.ok(derived.every((item) => item.sourceLabel === "基于合并案例库自动派生"));
  assert.ok(derived.every((item) => item.sourceUrl === DERIVED_SOURCE_URL));
  assert.ok(derived.every((item) => Array.isArray(item.derivedFrom) && item.derivedFrom.length > 0));
});

test("deriveTemplatesFromCases never overwrites an existing template id", () => {
  const existing = [template("derived-xhs-cover")];
  const derived = deriveTemplatesFromCases([caseItem(1, "xhs-cover")], existing, {
    targetCount: 2,
    sourceUrl: SOURCE_URL,
  });

  assert.deepEqual(
    derived.map((item) => item.id),
    [],
  );
});

test("getTemplateDerivationBase excludes regenerated derived templates but keeps manual overrides", () => {
  const base = getTemplateDerivationBase([
    template("poster-layout-system", { sourceType: "upstream-style" }),
    template("derived-xhs-cover", { sourceType: "derived-case" }),
    template("derived-manual-override", { sourceType: "manual" }),
    template("derived-legacy-generated"),
  ]);

  assert.deepEqual(
    base.map((item) => item.id),
    ["poster-layout-system", "derived-manual-override"],
  );
});

test("deriveTemplatesFromCases prefers bucket matches over keyword-only matches", () => {
  const existing = Array.from({ length: 22 }, (_, index) => template(`upstream-${index + 1}`));
  const derived = deriveTemplatesFromCases(
    [
      caseItem(100, "travel-poster", {
        title: "小红书旅行封面关键词案例",
        createdAt: "2026-05-01T00:00:00.000Z",
      }),
      caseItem(1, "xhs-cover", {
        title: "真实小红书封面案例",
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    ],
    existing,
    {
      sourceUrl: SOURCE_URL,
    },
  );

  const xhs = derived.find((item) => item.id === "derived-xhs-cover");
  assert.equal(xhs.derivedFrom[0], "1");
});

test("mergeTemplateCollections applies manual templates last and marks their source", () => {
  const merged = mergeTemplateCollections({
    upstreamTemplates: [
      enrichUpstreamTemplate(template("brand-identity-package", { title: "Upstream" }), SOURCE_URL),
    ],
    derivedTemplates: [template("derived-xhs-cover", { sourceType: "derived-case" })],
    manualTemplates: [
      template("brand-identity-package", {
        title: "Manual override",
      }),
    ],
  });

  const overridden = merged.find((item) => item.id === "brand-identity-package");
  assert.equal(overridden.title, "Manual override");
  assert.equal(overridden.sourceType, "manual");
  assert.equal(overridden.sourceLabel, "本项目手动模板");
  assert.equal(merged.length, 2);
}
);

test("mergeTemplateCollections puts dated manual templates first without reshuffling generated templates", () => {
  const merged = mergeTemplateCollections({
    upstreamTemplates: [
      template("upstream-a", { sourceType: "upstream-style" }),
      template("upstream-b", { sourceType: "upstream-style" }),
    ],
    derivedTemplates: [
      template("derived-a", { sourceType: "derived-case" }),
      template("derived-b", { sourceType: "derived-case" }),
    ],
    manualTemplates: [
      template("manual-old", {
        createdAt: "2026-05-20T00:00:00.000Z",
      }),
      template("manual-undated"),
      template("manual-new", {
        createdAt: "2026-05-25T00:00:00.000Z",
      }),
    ],
  });

  assert.deepEqual(
    merged.map((item) => item.id),
    ["manual-new", "manual-old", "manual-undated", "upstream-a", "upstream-b", "derived-a", "derived-b"],
  );
});

test("mergeTemplateCollections treats manual file entries as manual even with derived source metadata", () => {
  const merged = mergeTemplateCollections({
    upstreamTemplates: [template("upstream-template", { sourceType: "upstream-style" })],
    derivedTemplates: [template("derived-xhs-cover", { sourceType: "derived-case" })],
    manualTemplates: [
      template("derived-product-hero-shot", {
        sourceType: "derived-case",
        sourceLabel: "curated source note",
      }),
    ],
  });

  const manual = merged.find((item) => item.id === "derived-product-hero-shot");
  assert.equal(manual.sourceType, "manual");
  assert.equal(manual.sourceLabel, "curated source note");

  assert.deepEqual(
    getTemplateDerivationBase(merged).map((item) => item.id),
    ["derived-product-hero-shot", "upstream-template"],
  );
});

test("manual templates that are not generated blueprints expand beyond the target count", () => {
  const upstreamTemplates = Array.from({ length: 22 }, (_, index) =>
    template(`upstream-${index + 1}`),
  );
  const manualTemplates = [
    template("derived-product-hero-shot", {
      sourceType: "manual",
    }),
  ];
  const existing = [...upstreamTemplates, ...manualTemplates];
  const cases = [
    caseItem(1, "xhs-cover"),
    caseItem(2, "merchant-poster"),
    caseItem(3, "ecommerce"),
    caseItem(4, "portrait"),
    caseItem(5, "travel-poster"),
    caseItem(6, "festival"),
    caseItem(7, "wechat-grid"),
    caseItem(8, "sticker"),
    caseItem(9, "kids-portrait"),
    caseItem(10, "3d-ip"),
    caseItem(11, "brand-kv"),
    caseItem(12, "storyboard"),
    caseItem(13, "architecture"),
    caseItem(14, "document-publishing", {
      category: "文档与出版",
      userCategory: "other",
      tags: ["document", "publishing"],
    }),
  ];

  const derived = deriveTemplatesFromCases(cases, existing, {
    sourceUrl: DERIVED_SOURCE_URL,
  });
  const merged = mergeTemplateCollections({
    upstreamTemplates,
    derivedTemplates: derived,
    manualTemplates,
  });

  assert.equal(derived.length, TARGET_TEMPLATE_COUNT - upstreamTemplates.length);
  assert.equal(merged.length, TARGET_TEMPLATE_COUNT + manualTemplates.length);
  assert.ok(merged.some((item) => item.id === "derived-product-hero-shot"));
});
