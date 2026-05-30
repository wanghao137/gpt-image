import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyCase,
  scoreCase,
  USER_CATEGORY_LABEL,
  FALLBACK_CATEGORY,
} from "./classify-core.mjs";

/** Convenience: just the primary bucket. */
function primaryOf(caseLike) {
  return classifyCase(caseLike).primary;
}

// ─────────────────────────────────── regression cases (from the review) ──
// Each of these was MISCLASSIFIED by the old first-match classifier.

test("Korean cafe scrapbook poster → merchant-poster, NOT sticker", () => {
  const c = {
    title: "韩式咖啡馆饮品剪贴簿海报",
    category: "海报与排版",
    promptPreview:
      "目标：为一款韩式咖啡馆饮品创作一张梦幻复古的剪贴簿海报，以分层冰开心果环绕拿铁为中心，呈现 Pinterest 风格的咖啡馆日记设计，贴纸拼贴美学。",
    tags: ["Poster", "Commerce"],
    styles: ["Poster"],
    scenes: ["Commerce"],
  };
  assert.equal(primaryOf(c), "merchant-poster");
});

test("cute scrapbook food photography poster → merchant-poster, NOT sticker", () => {
  const c = {
    title: "可爱的剪贴簿风格美食摄影海报",
    category: "海报与排版",
    promptPreview:
      "可爱的剪贴簿纸风格美食摄影海报、美观的抹茶拿铁饮料平板画、卡哇伊咖啡馆设计、分层的冰抹茶配草莓泥和牛奶漩涡、混合涂鸦插图的现实饮料摄影、贴纸。",
    tags: ["Poster", "Realistic"],
    styles: ["Poster", "Realistic"],
    scenes: ["Commerce"],
  };
  assert.equal(primaryOf(c), "merchant-poster");
});

test("minimal luxury brand concept slides → brand-kv, NOT architecture", () => {
  const c = {
    title: "极简奢华品牌概念演示封面设计",
    category: "品牌与标志",
    promptPreview:
      "目标：为 BRAND 创建一张极简奢华品牌概念演示封面 Slides，采用分栏式编排，品牌主视觉与标志。",
    tags: ["Editorial", "Brand"],
    styles: ["Editorial"],
    scenes: ["Brand"],
  };
  assert.equal(primaryOf(c), "brand-kv");
});

test("cinematic portrait in exhibition interior → portrait, NOT architecture", () => {
  const c = {
    title: "展览室内的电影肖像",
    category: "摄影与写实",
    promptPreview:
      "一名女子独自站在黑暗的展览室内的电影肖像。她穿着，保留准确的面部特征、发型、刘海、面部比例、肤色、身体姿势，高度的身份一致性。",
    tags: ["Realistic", "Portrait"],
    styles: ["Realistic"],
    scenes: ["Portrait"],
  };
  assert.equal(primaryOf(c), "portrait");
});

test("summer night indoor portrait → portrait, NOT architecture", () => {
  const c = {
    title: "夏日夜晚室内微醺",
    category: "摄影与写实",
    promptPreview:
      "夏日夜晚室内氛围照，年轻亚洲女性，长黑发，手持酒瓶轻松微醺，坐在现代厨房餐桌旁。柔和灯光、自然阴影，皮肤微微高光，面颊带自然红晕。",
    tags: ["Realistic", "Portrait"],
    styles: ["Realistic"],
    scenes: ["Portrait"],
  };
  assert.equal(primaryOf(c), "portrait");
});

test("denim ad AI photo portrait → portrait, NOT classical", () => {
  const c = {
    title: "牛仔裤广告感 AI 写真",
    category: "摄影与写实",
    promptPreview:
      "生成一张 1:1 正方形超写实手机时尚写真拼图，整体像现代牛仔裤广告大片。画面为 4 宫格照片拼贴，同一位年轻成年女性出现在四个不同画面中。",
    tags: ["Realistic", "Fashion"],
    styles: ["Realistic"],
    scenes: ["Fashion"],
  };
  assert.equal(primaryOf(c), "portrait");
});

test("bedroom morning realism shot (stock title) → portrait, NOT architecture", () => {
  // Upstream stock title "室内空间渲染图" contradicts the actual portrait content.
  const c = {
    id: "414",
    title: "室内晨间写实摄影",
    category: "摄影与写实",
    promptPreview:
      "A close-medium shot of a young Japanese woman in her bedroom on an ordinary morning, natural light, candid film photography portrait.",
    tags: ["Realistic"],
    styles: ["Realistic"],
    scenes: ["Portrait"],
  };
  assert.equal(primaryOf(c), "portrait");
});

test("stock title '室内空间渲染图' over portrait prompt → portrait", () => {
  const c = {
    id: "53",
    title: "室内空间渲染图",
    category: "摄影与写实",
    promptPreview:
      "A vintage, late 90s amateur flash photograph of a young man repairing an arcade machine, looking back over his shoulder at the camera.",
    tags: ["UI", "Realistic", "Brand"],
    styles: ["UI", "Realistic", "Brand"],
    scenes: ["Tech", "Commerce", "Social"],
  };
  assert.equal(primaryOf(c), "portrait");
});

test("noisy 'UI' tag must NOT force ui-screenshot on a portrait", () => {
  // The auto-derived tag arrays spray "UI" across many non-UI cases; a bare
  // UI tag must not outvote real portrait content.
  const c = {
    id: "217",
    title: "昏暗室内纯真少女的意外回眸",
    category: "摄影与写实",
    promptPreview:
      "手机照片，老式CCD相机美学，刺眼的闪光灯，颗粒感，昏暗杂乱的室内光线，抓拍快照感觉。年轻的韩国女偶像，温柔纯真的外表，动作进行中，微微转头看向镜头。",
    tags: ["Realistic", "Character"],
    styles: ["Realistic", "Character"],
    scenes: ["Tech", "Commerce", "Fashion"],
  };
  assert.equal(primaryOf(c), "portrait");
});

test("genuine livestream UI mockup → ui-screenshot", () => {
  const c = {
    id: "21",
    title: "直播界面设计图",
    category: "UI 与界面",
    promptPreview:
      "{ \"type\": \"live stream UI mockup\", \"subject\": { \"description\": \"portrait of host\" }, 手机系统状态栏 UI, screenshot of a Douyin livestream.",
    tags: ["UI", "Product", "Brand"],
    styles: ["UI", "Product", "Brand"],
    scenes: ["Tech", "Commerce", "Social"],
  };
  assert.equal(primaryOf(c), "ui-screenshot");
});

// ─────────────────────────────────────────────── positive sanity cases ──

test("infographic stays infographic", () => {
  const c = {
    title: "信息图可视化设计",
    category: "图表与信息图",
    promptPreview:
      "Vertical 9:16 isometric cutaway infographic, urban metabolism atlas, knowledge map with timeline.",
    tags: ["Infographic"],
    styles: ["Infographic"],
    scenes: ["Education"],
  };
  assert.equal(primaryOf(c), "infographic");
});

test("ecommerce product shot stays ecommerce", () => {
  const c = {
    title: "电商商品展示设计",
    category: "产品与电商",
    promptPreview:
      "A 3D render of a cute product on a pure white background, 主图 for 淘宝 listing, product packaging mockup.",
    tags: ["Product", "Commerce"],
    styles: ["Studio"],
    scenes: ["Commerce", "Product"],
  };
  assert.equal(primaryOf(c), "ecommerce");
});

test("xiaohongshu cover wins over generic poster", () => {
  const c = {
    title: "小红书封面",
    category: "海报与排版",
    promptPreview: "画一张小红书封面，标题党风格海报，xiaohongshu cover thumbnail。",
    tags: ["Poster", "Social"],
    styles: ["Poster"],
    scenes: ["Social"],
  };
  assert.equal(primaryOf(c), "xhs-cover");
});

test("3D figurine wins over illustration", () => {
  const c = {
    title: "潮玩手办设计",
    category: "插画与艺术",
    promptPreview: "3D character figurine, blind box collectible toy, Pixar style mascot.",
    tags: ["3D"],
    styles: ["3D Render"],
    scenes: ["Commerce"],
  };
  assert.equal(primaryOf(c), "3d-ip");
});

// ─────────────────────────────────────────────────── structural checks ──

test("classifyCase always returns a known bucket", () => {
  const result = classifyCase({ title: "", category: "", promptPreview: "" });
  assert.ok(
    Object.prototype.hasOwnProperty.call(USER_CATEGORY_LABEL, result.primary),
    `primary ${result.primary} must be a known bucket`,
  );
});

test("empty case falls back via ratio then other", () => {
  assert.equal(classifyCase({ ratio: "1:1" }).primary, "ecommerce");
  assert.equal(classifyCase({ ratio: "16:9" }).primary, "architecture");
  assert.equal(classifyCase({ ratio: "" }).primary, FALLBACK_CATEGORY);
});

test("secondaries are real runners-up, not grazes", () => {
  const c = {
    title: "韩式咖啡馆饮品剪贴簿海报",
    category: "海报与排版",
    promptPreview:
      "为一款韩式咖啡馆饮品创作一张梦幻复古的剪贴簿海报，分层冰开心果环绕拿铁，Pinterest 风格咖啡馆日记设计。",
    tags: ["Poster", "Illustration"],
    styles: ["Poster", "Illustration"],
    scenes: ["Commerce"],
  };
  const { primary, secondaries } = classifyCase(c);
  assert.equal(primary, "merchant-poster");
  assert.ok(Array.isArray(secondaries));
  assert.ok(secondaries.length <= 2);
  assert.ok(!secondaries.includes(primary));
});

test("scoreCase returns a descending breakdown", () => {
  const ranked = scoreCase({
    title: "人像写真",
    promptPreview: "portrait of a young woman, cinematic portrait, 写真。",
  });
  assert.ok(ranked.length > 0);
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(ranked[i - 1][1] >= ranked[i][1], "scores must be sorted descending");
  }
  assert.equal(ranked[0][0], "portrait");
});
