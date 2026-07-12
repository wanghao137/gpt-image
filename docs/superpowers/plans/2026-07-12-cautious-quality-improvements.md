# TaoStudio Cautious Quality Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce analytics HTTP fan-out, close the analytics body-size bypass, and make favorites persistence failure-safe without changing normal public behavior.

**Architecture:** Keep all changes inside existing analytics and favorites boundaries. Replace individual Upstash REST calls with one validated pipeline request per analytics operation, enforce the existing 16 KiB contract for every parsed-body shape, and isolate browser-storage failure handling in a tiny pure helper that can be tested with `node:test`.

**Tech Stack:** Node.js ESM, Vercel Functions, Upstash Redis REST API, React 18, TypeScript 5, Node built-in test runner, Git, Vercel auto-deploy.

## Global Constraints

- Preserve all existing public API paths, response shapes, configuration names, data structures, Redis keys, TTLs, storage keys, and normal user-visible behavior.
- Do not add dependencies.
- Do not stage or modify existing generated data, prompts, images, or unrelated dirty files.
- Use failing regression tests before each implementation change.
- Run the smallest relevant test first, then `npm run check` after each round.
- Run the final production build in a temporary clean worktree so prebuild cannot overwrite the main workspace's existing generated-data changes.
- Use explicit `git add <path>` commands only.

---

### Task 0: Establish an ignored isolated implementation worktree

**Files:**

- Modify: `.gitignore`
- Modify: `docs/superpowers/plans/2026-07-12-cautious-quality-improvements.md`

**Interfaces:**

- Consumes: current committed `main` and Git's linked-worktree mechanism.
- Produces: ignored path `.worktrees/cautious-quality-20260712` on branch `codex/cautious-quality-20260712`.

- [ ] **Step 1: Ignore the project-local worktree directory**

Add this entry beside the other local-tool directories in `.gitignore`:

```gitignore
/.worktrees/
```

- [ ] **Step 2: Verify the directory is ignored and commit the setup**

```powershell
git check-ignore -q .worktrees
git add -- .gitignore docs/superpowers/plans/2026-07-12-cautious-quality-improvements.md
git diff --cached --check
git commit -m "chore: ignore local worktrees"
```

Expected: ignore verification and commit both exit 0; no generated data is staged.

- [ ] **Step 3: Create and initialize the implementation worktree**

```powershell
git worktree add .worktrees/cautious-quality-20260712 -b codex/cautious-quality-20260712
npm ci --prefix .worktrees/cautious-quality-20260712
npm run check --prefix .worktrees/cautious-quality-20260712
```

Expected: the linked worktree is created from the current `HEAD`, dependencies install successfully, and all baseline checks pass before production-code edits begin.

### Task 1: Batch analytics Redis commands through one validated pipeline

**Files:**

- Modify: `src/server/site-analytics-core.mjs:212-343`
- Modify: `src/server/site-analytics-core.test.mjs:4-137`

**Interfaces:**

- Consumes: analytics config `{ kvUrl, kvToken, keyPrefix }`, Redis command arrays, and injectable `fetchImpl`.
- Produces: unchanged public signatures for `handleCollectPageView(options)` and `handleAnalyticsSummary(options)`.
- Internal contract: `redisPipeline(config, commands, fetchImpl)` returns one result per command in the same order or throws on HTTP, shape, length, or per-command errors.

- [ ] **Step 1: Add failing pipeline regression tests**

Update the import block in `src/server/site-analytics-core.test.mjs` to include the two handlers:

```js
import {
  authorizeAnalyticsSummaryRequest,
  buildPageViewRecord,
  buildSummaryDateKeys,
  getAnalyticsConfig,
  handleAnalyticsSummary,
  handleCollectPageView,
  isAuthorizedAnalyticsToken,
  parseRedisHash,
  parseRedisRankedPairs,
} from "./site-analytics-core.mjs";
```

Add this shared environment immediately after the import:

```js
const ANALYTICS_ENV = {
  KV_REST_API_URL: "https://redis.example.com",
  KV_REST_API_TOKEN: "kv-token",
  ANALYTICS_ADMIN_TOKEN: "admin-token",
};
```

Append these tests:

```js
test("batches one page view into one Redis pipeline request", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const commands = JSON.parse(init.body);
    calls.push({ url, init, commands });
    return {
      ok: true,
      status: 200,
      json: async () => commands.map(() => ({ result: "OK" })),
    };
  };

  const result = await handleCollectPageView({
    body: {
      url: "https://taostudioai.com/cases?utm_source=quality-test",
      referrer: "",
    },
    headers: {
      "user-agent": "TaoStudio quality test",
      "x-real-ip": "203.0.113.10",
      "x-vercel-ip-country": "CN",
    },
    env: ANALYTICS_ENV,
    now: new Date("2026-06-04T04:00:00.000Z"),
    fetchImpl,
  });

  assert.deepEqual(result, { ok: true, skipped: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://redis.example.com/pipeline");
  assert.equal(calls[0].init.headers.Authorization, "Bearer kv-token");
  assert.equal(calls[0].commands.length, 16);
  assert.deepEqual(calls[0].commands[0].slice(0, 2), [
    "PFADD",
    "taostudio:analytics:visitors:2026-06-04",
  ]);
  assert.deepEqual(calls[0].commands[1], [
    "HINCRBY",
    "taostudio:analytics:day:2026-06-04",
    "pageViews",
    1,
  ]);
});

test("reads a multi-day summary through one Redis pipeline request", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const commands = JSON.parse(init.body);
    calls.push({ url, commands });
    const payload = commands.map((_command, index) => {
      const day = Math.floor(index / 8) + 1;
      switch (index % 8) {
        case 0:
          return { result: ["pageViews", String(day * 10)] };
        case 1:
          return { result: day * 3 };
        case 2:
          return { result: [`/page-${day}`, String(day * 5)] };
        case 3:
          return { result: ["Direct", String(day * 4)] };
        case 4:
          return { result: ["Mobile", String(day * 3)] };
        case 5:
          return { result: ["Chrome", String(day * 2)] };
        case 6:
          return { result: ["Windows", String(day)] };
        default:
          return { result: ["CN", String(day * 6)] };
      }
    });
    return { ok: true, status: 200, json: async () => payload };
  };

  const summary = await handleAnalyticsSummary({
    days: 2,
    env: ANALYTICS_ENV,
    now: new Date("2026-06-04T04:00:00.000Z"),
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://redis.example.com/pipeline");
  assert.equal(calls[0].commands.length, 16);
  assert.deepEqual(summary.daily, [
    { date: "2026-06-03", pageViews: 10, visitors: 3 },
    { date: "2026-06-04", pageViews: 20, visitors: 6 },
  ]);
  assert.deepEqual(summary.totals, { pageViews: 30, visitors: 9 });
  assert.deepEqual(summary.topPages, [
    { label: "/page-2", value: 10 },
    { label: "/page-1", value: 5 },
  ]);
});

test("rejects a Redis pipeline response containing a command error", async () => {
  const fetchImpl = async (_url, init) => {
    const commands = JSON.parse(init.body);
    const payload = commands.map(() => ({ result: "OK" }));
    payload[3] = { error: "injected failure" };
    return { ok: true, status: 200, json: async () => payload };
  };

  await assert.rejects(
    () =>
      handleCollectPageView({
        body: { url: "https://taostudioai.com/cases", referrer: "" },
        headers: { "user-agent": "TaoStudio quality test", "x-real-ip": "203.0.113.10" },
        env: ANALYTICS_ENV,
        now: new Date("2026-06-04T04:00:00.000Z"),
        fetchImpl,
      }),
    /Redis pipeline command 4 failed: injected failure/,
  );
});
```

- [ ] **Step 2: Run the tests and confirm the current implementation fails**

Run:

```powershell
node --test src/server/site-analytics-core.test.mjs
```

Expected: non-zero exit because the current code calls the Redis REST endpoint once per command instead of calling `/pipeline` once.

- [ ] **Step 3: Replace individual Redis REST requests with pipeline helpers**

Replace `redisCommand` with:

```js
async function redisPipeline(config, commands, fetchImpl = fetch) {
  const response = await fetchImpl(`${config.kvUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.kvToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && !Array.isArray(payload) && typeof payload === "object"
        ? payload.error
        : "";
    throw new Error(detail || `Redis pipeline failed with ${response.status}`);
  }
  if (!Array.isArray(payload)) {
    throw new Error("Redis pipeline returned a non-array response");
  }
  if (payload.length !== commands.length) {
    throw new Error(
      `Redis pipeline returned ${payload.length} results for ${commands.length} commands`,
    );
  }
  return payload.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Redis pipeline command ${index + 1} returned an invalid result`);
    }
    if (item.error) {
      throw new Error(`Redis pipeline command ${index + 1} failed: ${item.error}`);
    }
    return item.result;
  });
}
```

In `recordPageView`, replace the final `Promise.all` with:

```js
  await redisPipeline(config, commands, fetchImpl);
```

Replace `readDailySummary` with these two pure helpers:

```js
function dailySummaryCommands(config, date) {
  const keys = analyticsKeys(config.keyPrefix, date);
  return [
    ["HGETALL", keys.day],
    ["PFCOUNT", keys.visitors],
    ["ZREVRANGE", keys.pages, 0, 9, "WITHSCORES"],
    ["ZREVRANGE", keys.referrers, 0, 9, "WITHSCORES"],
    ["ZREVRANGE", keys.devices, 0, 9, "WITHSCORES"],
    ["ZREVRANGE", keys.browsers, 0, 9, "WITHSCORES"],
    ["ZREVRANGE", keys.os, 0, 9, "WITHSCORES"],
    ["ZREVRANGE", keys.countries, 0, 9, "WITHSCORES"],
  ];
}

function parseDailySummary(date, results) {
  const [dayHash, visitors, pages, referrers, devices, browsers, os, countries] = results;
  const parsed = parseRedisHash(dayHash);
  return {
    date,
    pageViews: Number(parsed.pageViews || 0),
    visitors: Number(visitors || 0),
    pages: parseRedisRankedPairs(pages),
    referrers: parseRedisRankedPairs(referrers),
    devices: parseRedisRankedPairs(devices),
    browsers: parseRedisRankedPairs(browsers),
    os: parseRedisRankedPairs(os),
    countries: parseRedisRankedPairs(countries),
  };
}
```

In `handleAnalyticsSummary`, replace the current per-date `Promise.all` with:

```js
  const commands = dates.flatMap((date) => dailySummaryCommands(config, date));
  const results = await redisPipeline(config, commands, fetchImpl);
  const daily = dates.map((date, index) =>
    parseDailySummary(date, results.slice(index * 8, index * 8 + 8)),
  );
```

- [ ] **Step 4: Run targeted and full checks**

Run:

```powershell
node --test src/server/site-analytics-core.test.mjs
npm run check
```

Expected: all analytics-core tests pass and the full suite reports zero failures.

- [ ] **Step 5: Commit the analytics pipeline round**

```powershell
git add -- src/server/site-analytics-core.mjs src/server/site-analytics-core.test.mjs
git diff --cached --check
git commit -m "perf(analytics): batch Redis REST commands"
```

### Task 2: Enforce the analytics body limit for parsed objects

**Files:**

- Modify: `api/analytics/collect.js:18-35`
- Modify: `src/server/analytics-api.test.mjs:19-27`

**Interfaces:**

- Consumes: `req.body` as a string, parsed JSON object, or async request stream.
- Produces: unchanged valid-request behavior; every body shape over 16 KiB returns `413` with code `BODY_TOO_LARGE`.

- [ ] **Step 1: Add the failing parsed-object regression test**

Append:

```js
test("analytics collect rejects oversized parser-provided object bodies", async () => {
  const res = createResponse();
  const oversizedBody = { path: "/", extra: "x".repeat(16 * 1024) };

  await collectHandler({ method: "POST", headers: {}, body: oversizedBody }, res);

  assert.equal(res.statusCode, 413);
  assert.equal(JSON.parse(res.body).error.code, "BODY_TOO_LARGE");
});
```

- [ ] **Step 2: Run the test and confirm it fails on the object path**

```powershell
node --test src/server/analytics-api.test.mjs
```

Expected: the new test fails because the current object branch returns `req.body` without a byte-size check.

- [ ] **Step 3: Apply one size check to parser-provided strings and objects**

Add before `readJsonBody`:

```js
function assertBodyWithinLimit(body) {
  const serialized = typeof body === "string" ? body : JSON.stringify(body);
  if (Buffer.byteLength(serialized || "") > MAX_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
}
```

Replace the parser-provided branch with:

```js
  if (req.body != null) {
    assertBodyWithinLimit(req.body);
    if (typeof req.body === "string") {
      return JSON.parse(req.body || "{}");
    }
    return req.body;
  }
```

- [ ] **Step 4: Run targeted and full checks**

```powershell
node --test src/server/analytics-api.test.mjs
npm run check
```

Expected: both string and object oversize tests return 413 and the full suite has zero failures.

- [ ] **Step 5: Commit the request-boundary round**

```powershell
git add -- api/analytics/collect.js src/server/analytics-api.test.mjs
git diff --cached --check
git commit -m "fix(analytics): enforce parsed body size limit"
```

### Task 3: Make favorites persistence failure-safe

**Files:**

- Modify: `src/hooks/favorites-core.mjs:1-22`
- Modify: `src/hooks/favorites-core.test.mjs:1-18`
- Modify: `src/hooks/useFavorites.ts:1-47`

**Interfaces:**

- Consumes: a callback that writes one serialized value and an iterable of favorite IDs.
- Produces: `persistFavoriteIds(write, ids): boolean`; existing `parseFavoriteIds(raw)` and `useFavorites()` behavior remain compatible.

- [ ] **Step 1: Add failing persistence tests**

Replace the test import with:

```js
import { parseFavoriteIds, persistFavoriteIds } from "./favorites-core.mjs";
```

Append:

```js
test("persistFavoriteIds keeps the existing JSON array format", () => {
  const writes = [];

  const persisted = persistFavoriteIds((value) => writes.push(value), new Set(["1", "2"]));

  assert.equal(persisted, true);
  assert.deepEqual(writes, ['["1","2"]']);
});

test("persistFavoriteIds contains browser storage failures", () => {
  const persisted = persistFavoriteIds(() => {
    throw new DOMException("Storage is disabled", "SecurityError");
  }, new Set(["1"]));

  assert.equal(persisted, false);
});
```

- [ ] **Step 2: Run the test and confirm the helper is missing**

```powershell
node --test src/hooks/favorites-core.test.mjs
```

Expected: non-zero exit because `persistFavoriteIds` is not exported yet.

- [ ] **Step 3: Add the minimal persistence boundary**

Append to `favorites-core.mjs`:

```js
export function persistFavoriteIds(write, ids) {
  try {
    write(JSON.stringify(Array.from(ids)));
    return true;
  } catch {
    return false;
  }
}
```

Update the hook import:

```ts
import { parseFavoriteIds, persistFavoriteIds } from "./favorites-core.mjs";
```

Replace the unguarded write effect line with:

```ts
    persistFavoriteIds(
      (value) => window.localStorage.setItem(KEY, value),
      ids,
    );
```

The callback is invoked inside the helper's `try`, so both access to `window.localStorage` and `setItem` failures are contained.

- [ ] **Step 4: Run targeted and full checks**

```powershell
node --test src/hooks/favorites-core.test.mjs
npm run check
```

Expected: parser compatibility and both persistence paths pass; the full suite has zero failures.

- [ ] **Step 5: Commit the favorites round**

```powershell
git add -- src/hooks/favorites-core.mjs src/hooks/favorites-core.test.mjs src/hooks/useFavorites.ts
git diff --cached --check
git commit -m "fix(favorites): contain storage write failures"
```

### Task 4: Final verification, push, deployment, and production proof

**Files:**

- Verify: all files committed by Tasks 1-3
- Preserve: existing modifications under `data/` and `public/`
- Deploy: current `main` through the existing GitHub/Vercel integration

**Interfaces:**

- Consumes: committed `main`, GitHub remote `origin`, Vercel production domain `taostudioai.com`.
- Produces: green local quality gates, green remote checks, successful production responses, and no accidental generated-data commit.

- [ ] **Step 1: Run fresh final local quality gates**

```powershell
npm run check
npm run lint
git status --short --untracked-files=no
git log -5 --oneline
```

Expected: check has zero failures; lint has zero errors and only the two known Fast Refresh warnings; tracked dirty files outside the commits remain limited to the pre-existing generated data.

- [ ] **Step 2: Build from a clean temporary worktree**

Run from `D:\codesolo\gpt-image`:

```powershell
$sha = git rev-parse --short HEAD
$worktreeParent = "D:\codesolo\.worktrees"
$verifyRoot = Join-Path $worktreeParent "gpt-image-quality-$sha"
New-Item -ItemType Directory -Force -Path $worktreeParent | Out-Null
$resolvedParent = [System.IO.Path]::GetFullPath((Split-Path -Parent $verifyRoot))
if ($resolvedParent -ne [System.IO.Path]::GetFullPath($worktreeParent)) {
  throw "Verification worktree escaped the approved parent"
}
git worktree add --detach $verifyRoot HEAD
npm ci --prefix $verifyRoot
npm run build --prefix $verifyRoot
git -C $verifyRoot status --short --untracked-files=no
git worktree remove --force $verifyRoot
git worktree prune
```

Expected: `npm ci` and `npm run build` exit 0. Generated build changes stay inside the temporary worktree and are removed with it.

- [ ] **Step 3: Verify commit scope and push `main`**

```powershell
git status --short --untracked-files=no
git log --name-status --oneline -4
git -c http.version=HTTP/1.1 push origin main
```

Expected: the recent commits contain only the design, plan, analytics, tests, and favorites files; push completes successfully without staging existing generated data.

- [ ] **Step 4: Verify GitHub checks for the pushed commit**

Use the installed GitHub connector to inspect the current `HEAD` commit and its check runs. If the connector is unavailable, run:

```powershell
$headSha = git rev-parse HEAD
gh api "repos/wanghao137/gpt-image/commits/$headSha/check-runs" --jq '.check_runs[] | [.name, .status, .conclusion] | @tsv'
```

Expected: build/deploy checks reach a completed successful state. A still-running check must be polled rather than reported as successful.

- [ ] **Step 5: Verify production behavior**

Run a homepage probe:

```powershell
curl.exe -sS -D - -o NUL https://taostudioai.com/
```

Expected: `200 OK` and `Server: Vercel`.

Run a normal analytics pipeline probe:

```powershell
$normalBody = '{"url":"https://taostudioai.com/about","referrer":""}'
curl.exe -sS -D - -H "Content-Type: application/json" --data-binary $normalBody https://taostudioai.com/api/analytics/collect
```

Expected: HTTP 202 with `{"ok":true,"skipped":false}`. This proves the production function can execute the new Redis pipeline successfully.

Run the parsed-object limit probe:

```powershell
$oversizedBody = @{ path = "/"; extra = "x" * (16 * 1024) } | ConvertTo-Json -Compress
curl.exe -sS -D - -H "Content-Type: application/json" --data-binary $oversizedBody https://taostudioai.com/api/analytics/collect
```

Expected: HTTP 413 with error code `BODY_TOO_LARGE`.

- [ ] **Step 6: Re-audit and stop at the evidence boundary**

Re-run targeted searches for unprotected storage writes, individual analytics Redis requests, and remaining lint errors. Do not modify large React components, Fast Refresh warning files, generated data, or Hermes behavior unless a new candidate has concrete impact, lower risk than the completed work, and a deterministic test.

Expected: no additional candidate meets all execution criteria; produce the final round-by-round report with verification and deployment evidence.
