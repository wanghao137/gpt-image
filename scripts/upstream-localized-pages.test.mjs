import assert from "node:assert/strict";
import test from "node:test";
import {
  extractYouMindLocalizedPrompt,
  fetchYouMindLocalizedPrompt,
  repairRecentPromptLocales,
  selectLocaleRepairCandidates,
} from "./upstream-localized-pages.mjs";

function localizedHtml(id, values = {}) {
  const title = values.title || "奢华时尚杂志风肖像";
  const description = values.description || "生成一张高端时尚广告肖像。";
  const prompt = values.prompt || "创作一张电影质感的奢华时尚杂志风摄影作品。";
  const jsonLd = JSON.stringify({
    "@graph": [{
      "@type": "CreativeWork",
      "@id": `https://youmind.com/zh-CN/prompts/prompt-${id}#creativework`,
      name: title,
      description,
    }],
  });
  const flight = `45:["$","$L31",null,${JSON.stringify({
    content: "$32",
    promptId: Number(id),
    collection: "prompts",
    translatedContent: prompt,
    locale: "zh-CN",
  })}]`;
  return `<script type="application/ld+json">${jsonLd}</script>` +
    `<script>self.__next_f.push([1,${JSON.stringify(flight)}])</script>`;
}

function localizedHtmlWithFlightReference(id) {
  const prompt = "\u521b\u5efa\u4e00\u5e45\u957f\u6587\u672c\u4e2d\u6587\u63d0\u793a\u8bcd\uff0c\u4fdd\u7559\u5b8c\u6574\u7ec6\u8282\u3002";
  const promptLength = new TextEncoder().encode(prompt).length.toString(16);
  const jsonLd = JSON.stringify({
    "@graph": [{
      "@type": "CreativeWork",
      "@id": `https://youmind.com/zh-CN/prompts/prompt-${id}#creativework`,
      name: "\u957f\u6587\u672c\u7ffb\u8bd1\u6848\u4f8b",
      description: "\u9a8c\u8bc1 React Flight \u957f\u6587\u672c\u5f15\u7528\u3002",
    }],
  });
  const component = `${id}:["$","$L31",null,${JSON.stringify({
    promptId: Number(id),
    translatedContent: "$33",
    locale: "zh-CN",
  })}]`;
  const stream = `previous-record-without-a-newline${"33"}:T${promptLength},${prompt}${component}`;
  const splitAt = Math.floor(stream.length / 2);
  return `<script type="application/ld+json">${jsonLd}</script>` +
    `<script>self.__next_f.push([1,${JSON.stringify(stream.slice(0, splitAt))}]);` +
    `self.__next_f.push([1,${JSON.stringify(stream.slice(splitAt))}])</script>`;
}

test("localized detail parsing extracts CMS title description and translated prompt", () => {
  assert.deepEqual(extractYouMindLocalizedPrompt(localizedHtml("28782"), "28782"), {
    title: "奢华时尚杂志风肖像",
    description: "生成一张高端时尚广告肖像。",
    prompt: "创作一张电影质感的奢华时尚杂志风摄影作品。",
  });
});

test("localized detail parsing resolves long translated prompts stored as Flight text references", () => {
  assert.deepEqual(extractYouMindLocalizedPrompt(localizedHtmlWithFlightReference("28710"), "28710"), {
    title: "\u957f\u6587\u672c\u7ffb\u8bd1\u6848\u4f8b",
    description: "\u9a8c\u8bc1 React Flight \u957f\u6587\u672c\u5f15\u7528\u3002",
    prompt: "\u521b\u5efa\u4e00\u5e45\u957f\u6587\u672c\u4e2d\u6587\u63d0\u793a\u8bcd\uff0c\u4fdd\u7559\u5b8c\u6574\u7ec6\u8282\u3002",
  });
});

test("localized detail parsing rejects English-only or mismatched pages", () => {
  assert.equal(extractYouMindLocalizedPrompt(localizedHtml("28782", {
    title: "English title",
    prompt: "English prompt",
  }), "28782"), null);
  assert.equal(extractYouMindLocalizedPrompt(localizedHtml("28781"), "28782"), null);
});

test("repair candidates stay bounded to recent missing locale records", () => {
  const items = Array.from({ length: 8 }, (_, index) => ({ id: String(100 + index) }));
  const locales = new Map([["107", { zh: { title: "已有", prompt: "已有提示" } }]]);
  assert.deepEqual(
    selectLocaleRepairCandidates(items, locales, { windowSize: 5, limit: 2 }).map((item) => item.id),
    ["106", "105"],
  );
});

test("public detail repair merges bilingual values and uses stable id-only routes", async () => {
  const requested = [];
  const items = [
    { id: "28782", title: "Luxury Fashion", description: "English", content: "English prompt" },
    { id: "28781", title: "Menswear", description: "English", content: "English prompt" },
  ];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    const id = String(url).match(/(\d+)$/)?.[1];
    return { ok: true, status: 200, text: async () => localizedHtml(id) };
  };
  const repaired = await repairRecentPromptLocales(items, new Map(), {
    fetchImpl,
    origin: "https://example.test/zh-CN/prompts",
    windowSize: 10,
    limit: 10,
    concurrency: 2,
  });
  assert.equal(repaired.repaired, 2);
  assert.equal(repaired.locales.get("28782").en.prompt, "English prompt");
  assert.equal(repaired.locales.get("28782").zh.title, "奢华时尚杂志风肖像");
  assert.deepEqual(requested.sort(), [
    "https://example.test/zh-CN/prompts/prompt-28781",
    "https://example.test/zh-CN/prompts/prompt-28782",
  ]);
  assert.deepEqual(
    await fetchYouMindLocalizedPrompt(items[0], { fetchImpl, origin: "https://example.test/zh-CN/prompts" }),
    { title: "奢华时尚杂志风肖像", description: "生成一张高端时尚广告肖像。", prompt: "创作一张电影质感的奢华时尚杂志风摄影作品。" },
  );
});

test("public detail repair aborts the batch after a failed preflight", async () => {
  let calls = 0;
  const result = await repairRecentPromptLocales(
    [{ id: "3" }, { id: "2" }, { id: "1" }],
    new Map(),
    { fetchImpl: async () => { calls += 1; throw new Error("offline"); } },
  );
  assert.equal(calls, 1);
  assert.deepEqual(
    { attempted: result.attempted, repaired: result.repaired, failed: result.failed, skipped: result.skipped },
    { attempted: 1, repaired: 0, failed: 1, skipped: 2 },
  );
});
