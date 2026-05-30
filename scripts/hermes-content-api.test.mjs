import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHermesContentUpdate,
  commitFilesToGitHub,
  getHermesApiKey,
  isAuthorizedHermesRequest,
  readGitHubTextFile,
} from "../src/server/hermes-content-core.mjs";

const emptyCases = "[]\n";
const emptyTemplates = "[]\n";

test("Hermes API auth accepts Bearer and x-hermes-api-key values only", () => {
  assert.equal(
    isAuthorizedHermesRequest(
      { headers: { authorization: "Bearer secret-key" } },
      "secret-key",
    ),
    true,
  );
  assert.equal(
    isAuthorizedHermesRequest(
      { headers: { "x-hermes-api-key": "secret-key" } },
      "secret-key",
    ),
    true,
  );
  assert.equal(
    isAuthorizedHermesRequest(
      { headers: { authorization: "Bearer wrong-key" } },
      "secret-key",
    ),
    false,
  );
  assert.equal(isAuthorizedHermesRequest({ headers: {} }, "secret-key"), false);
  assert.throws(() => getHermesApiKey({}), /HERMES_ADMIN_API_KEY/);
});

test("buildHermesContentUpdate upserts a case with generated id and inferred helper fields", () => {
  const result = buildHermesContentUpdate({
    body: {
      kind: "case",
      action: "upsert",
      item: {
        title: "小红书奶茶新品促销海报",
        category: "海报与排版",
        styles: [],
        scenes: [],
        imageUrl: "/uploads/2026-05-24-case-100001-milk-tea.jpg",
        prompt:
          "为本地奶茶门店生成竖版 poster，突出限时促销、价格标签、真实商品摄影和手机端可读标题。",
      },
      uploads: [
        {
          path: "public/uploads/2026-05-24-case-100001-milk-tea.jpg",
          contentBase64: `data:image/jpeg;base64,${Buffer.from("fake image").toString("base64")}`,
        },
      ],
    },
    casesText: JSON.stringify([{ id: "100005", title: "已有案例" }], null, 2),
    templatesText: emptyTemplates,
  });

  assert.equal(result.summary.kind, "case");
  assert.equal(result.summary.id, "100006");
  assert.equal(result.files.length, 2);
  assert.equal(result.files[0].path, "data/manual/cases.json");
  assert.equal(result.files[1].path, "public/uploads/2026-05-24-case-100001-milk-tea.jpg");
  assert.equal(result.files[1].content, Buffer.from("fake image").toString("base64"));

  const cases = JSON.parse(result.files[0].content);
  assert.equal(cases[0].id, "100006");
  assert.equal(cases[0].title, "小红书奶茶新品促销海报");
  assert.ok(cases[0].styles.includes("Poster"));
  assert.ok(cases[0].scenes.includes("Commerce"));
  assert.ok(cases[0].tags.includes("Poster"));
  assert.match(cases[0].promptPreview, /本地奶茶门店/);
  assert.equal(cases[0].imageAlt, "小红书奶茶新品促销海报");
  assert.match(cases[0].createdAt, /^20\d{2}-\d{2}-\d{2}T/);
});

test("buildHermesContentUpdate rejects invalid upload paths and incomplete cases", () => {
  assert.throws(
    () =>
      buildHermesContentUpdate({
        body: {
          kind: "case",
          action: "upsert",
          item: {
            title: "缺少 Prompt",
            category: "海报与排版",
            imageUrl: "/uploads/demo.jpg",
          },
        },
        casesText: emptyCases,
        templatesText: emptyTemplates,
      }),
    /prompt is required/,
  );

  assert.throws(
    () =>
      buildHermesContentUpdate({
        body: {
          kind: "case",
          action: "upsert",
          item: {
            title: "非法路径",
            category: "海报与排版",
            imageUrl: "/uploads/demo.jpg",
            prompt: "完整 Prompt",
          },
          uploads: [
            {
              path: "public/../secrets.txt",
              contentBase64: Buffer.from("bad").toString("base64"),
            },
          ],
        },
        casesText: emptyCases,
        templatesText: emptyTemplates,
      }),
    /uploads must stay under public\/uploads/,
  );
});

test("buildHermesContentUpdate upserts a reusable template", () => {
  const result = buildHermesContentUpdate({
    body: {
      kind: "template",
      action: "upsert",
      item: {
        id: "merchant-promo-poster",
        title: "商家促销海报模板",
        category: "海报与排版",
        tags: [],
        description: "",
        cover: "/uploads/merchant-promo.jpg",
        prompt: "模板化 Prompt，包含主体、活动、价格、构图和风格约束。",
        useWhen: "",
        sourceType: "manual",
      },
    },
    casesText: emptyCases,
    templatesText: "[]\n",
  });

  assert.equal(result.summary.kind, "template");
  assert.equal(result.summary.id, "merchant-promo-poster");
  assert.equal(result.files[0].path, "data/manual/templates.json");

  const templates = JSON.parse(result.files[0].content);
  assert.equal(templates[0].id, "merchant-promo-poster");
  assert.match(templates[0].createdAt, /^20\d{2}-\d{2}-\d{2}T/);
  assert.equal(templates[0].description, "用于海报与排版的商家促销海报模板。");
  assert.equal(
    templates[0].useWhen,
    "适合需要快速复用「商家促销海报模板」结构的内容生产场景。",
  );
  assert.ok(templates[0].tags.includes("Poster"));
});

test("commitFilesToGitHub creates one commit with all changed files", async () => {
  const calls = [];
  const responses = [
    { object: { sha: "head-sha" } },
    { tree: { sha: "base-tree-sha" } },
    { sha: "blob-json" },
    { sha: "blob-image" },
    { sha: "new-tree-sha" },
    { sha: "new-commit-sha", html_url: "https://github.com/example/commit/new" },
    { ref: "refs/heads/main", object: { sha: "new-commit-sha" } },
  ];

  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const payload = responses.shift();
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    };
  };

  const result = await commitFilesToGitHub({
    fetchImpl,
    owner: "wanghao137",
    repo: "gpt-image",
    branch: "main",
    token: "github-token",
    message: "content(api): add Hermes item",
    files: [
      { path: "data/manual/cases.json", content: "[]\n", encoding: "utf-8" },
      {
        path: "public/uploads/demo.jpg",
        content: Buffer.from("image").toString("base64"),
        encoding: "base64",
      },
    ],
  });

  assert.equal(result.commitSha, "new-commit-sha");
  assert.equal(calls.length, 7);
  assert.match(calls[0].url, /\/git\/ref\/heads\/main$/);
  assert.match(calls[2].url, /\/git\/blobs$/);
  assert.equal(JSON.parse(calls[2].init.body).encoding, "utf-8");
  assert.equal(JSON.parse(calls[3].init.body).encoding, "base64");
  assert.match(calls[4].url, /\/git\/trees$/);
  assert.deepEqual(
    JSON.parse(calls[4].init.body).tree.map((entry) => entry.path),
    ["data/manual/cases.json", "public/uploads/demo.jpg"],
  );
  assert.match(calls[6].url, /\/git\/refs\/heads\/main$/);
  assert.equal(JSON.parse(calls[6].init.body).force, false);
});

test("buildHermesContentUpdate rejects too many uploads and oversized combined payload", () => {
  const oneByte = Buffer.from("x").toString("base64");
  // Too many files
  assert.throws(
    () =>
      buildHermesContentUpdate({
        body: {
          kind: "case",
          action: "upsert",
          item: {
            title: "多图",
            category: "海报与排版",
            imageUrl: "/uploads/a.jpg",
            prompt: "完整 Prompt",
          },
          uploads: Array.from({ length: 9 }, (_, i) => ({
            path: `public/uploads/img-${i}.jpg`,
            contentBase64: oneByte,
          })),
        },
        casesText: emptyCases,
        templatesText: emptyTemplates,
      }),
    /uploads must not exceed/,
  );

  // Duplicate upload paths
  assert.throws(
    () =>
      buildHermesContentUpdate({
        body: {
          kind: "case",
          action: "upsert",
          item: {
            title: "重复路径",
            category: "海报与排版",
            imageUrl: "/uploads/dup.jpg",
            prompt: "完整 Prompt",
          },
          uploads: [
            { path: "public/uploads/dup.jpg", contentBase64: oneByte },
            { path: "public/uploads/dup.jpg", contentBase64: oneByte },
          ],
        },
        casesText: emptyCases,
        templatesText: emptyTemplates,
      }),
    /duplicate upload path/,
  );
});

test("commitFilesToGitHub maps a non-fast-forward PATCH to a REF_CONFLICT", async () => {
  const responses = [
    { ok: true, status: 200, json: async () => ({ object: { sha: "head-sha" } }), text: async () => "" },
    { ok: true, status: 200, json: async () => ({ tree: { sha: "base-tree" } }), text: async () => "" },
    { ok: true, status: 200, json: async () => ({ sha: "blob-1" }), text: async () => "" },
    { ok: true, status: 200, json: async () => ({ sha: "tree-1" }), text: async () => "" },
    { ok: true, status: 200, json: async () => ({ sha: "commit-1", html_url: "x" }), text: async () => "" },
    // PATCH ref → 422 non-fast-forward
    { ok: false, status: 422, statusText: "Unprocessable Entity", json: async () => ({}), text: async () => "Update is not a fast forward" },
  ];
  const fetchImpl = async () => responses.shift();

  await assert.rejects(
    () =>
      commitFilesToGitHub({
        fetchImpl,
        owner: "o",
        repo: "r",
        branch: "main",
        token: "t",
        message: "m",
        files: [{ path: "data/manual/cases.json", content: "[]\n", encoding: "utf-8" }],
      }),
    (err) => err.code === "REF_CONFLICT" && err.status === 409,
  );
});

test("readGitHubTextFile preserves slashes in GitHub contents paths", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        encoding: "base64",
        content: Buffer.from("[]\n", "utf8").toString("base64"),
      }),
      text: async () => "",
    };
  };

  const text = await readGitHubTextFile({
    fetchImpl,
    owner: "wanghao137",
    repo: "gpt-image",
    branch: "main",
    token: "github-token",
    path: "data/manual/cases.json",
  });

  assert.equal(text, "[]\n");
  assert.match(calls[0], /\/contents\/data\/manual\/cases\.json\?ref=main$/);
  assert.doesNotMatch(calls[0], /data%2Fmanual%2Fcases\.json/);
});
