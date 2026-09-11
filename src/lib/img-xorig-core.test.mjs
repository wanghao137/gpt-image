import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  WSRV_BASE,
  YOUMIND_X_MEDIA_RE,
  xOriginalUrl,
  wsrvTransformUrl,
  wsrvPassthroughUrl,
  withErrorRedirect,
  xOrigWsrvTransformUrl,
} from "./img-xorig-core.mjs";

const YOUMIND_JPG =
  "https://cms-assets.youmind.com/media/1788942288291_1ovagz_HRu3ie-bwAATJ-v.jpg";
const X_ORIG_JPG = "https://pbs.twimg.com/media/HRu3ie-bwAATJ-v?format=jpg&name=orig";

test("xOriginalUrl extracts the X media key from YouMind filenames", () => {
  assert.equal(xOriginalUrl(YOUMIND_JPG), X_ORIG_JPG);
});

test("xOriginalUrl normalises jpeg→jpg and passes png/webp through", () => {
  const jpeg = "https://cms-assets.youmind.com/media/1_ab_GHabc123XYZ_-1.jpeg";
  assert.equal(
    xOriginalUrl(jpeg),
    "https://pbs.twimg.com/media/GHabc123XYZ_-1?format=jpg&name=orig",
  );
  const png = "https://cms-assets.youmind.com/media/1_ab_GHabc123XYZ_-1.png";
  assert.match(xOriginalUrl(png), /format=png&name=orig/);
  const webp = "https://cms-assets.youmind.com/media/1_ab_GHabc123XYZ_-1.WEBP";
  assert.match(xOriginalUrl(webp), /format=webp&name=orig/);
});

test("xOriginalUrl rejects non-YouMind and malformed URLs", () => {
  assert.equal(xOriginalUrl("https://example.com/media/1_ab_GHabc123XYZ_-1.jpg"), null);
  assert.equal(xOriginalUrl("https://cms-assets.youmind.com/media/plain.jpg"), null);
  assert.equal(xOriginalUrl("/images/case123.jpg"), null);
  assert.equal(xOriginalUrl(null), null);
  assert.equal(xOriginalUrl(undefined), null);
  assert.equal(xOriginalUrl(""), null);
});

test("wsrvTransformUrl carries width/quality/format and never enlarges", () => {
  const url = new URL(wsrvTransformUrl("https://up.example/a/b.jpg", { width: 560, quality: 90 }));
  assert.equal(url.origin + url.pathname, WSRV_BASE);
  assert.equal(url.searchParams.get("url"), "up.example/a/b.jpg");
  assert.equal(url.searchParams.get("w"), "560");
  assert.equal(url.searchParams.get("output"), "webp");
  assert.equal(url.searchParams.get("q"), "90");
  assert.equal(url.searchParams.get("we"), "1");
  assert.equal(url.searchParams.get("il"), "1");
  // width is clamped to ≥1
  const clamped = new URL(wsrvTransformUrl("https://up.example/a.jpg", { width: 0 }));
  assert.equal(clamped.searchParams.get("w"), "1");
});

test("wsrvTransformUrl preserves the X inner query (?format=&name=orig)", () => {
  const url = new URL(wsrvTransformUrl(X_ORIG_JPG, { width: 1920, quality: 90 }));
  assert.equal(
    url.searchParams.get("url"),
    "pbs.twimg.com/media/HRu3ie-bwAATJ-v?format=jpg&name=orig",
  );
});

test("withErrorRedirect appends a fully-encoded fallback URL", () => {
  const primary = wsrvTransformUrl(X_ORIG_JPG, { width: 1920, quality: 90 });
  const fallback = wsrvTransformUrl(YOUMIND_JPG, { width: 1920, quality: 90 });
  const chained = withErrorRedirect(primary, fallback);
  assert.ok(chained.startsWith(primary + "&errorredirect="));
  const url = new URL(chained);
  // The encoded fallback must decode back exactly, & separators included.
  assert.equal(url.searchParams.get("errorredirect"), fallback);
});

test("xOrigWsrvTransformUrl: X first, YouMind 302 fallback, legacy path otherwise", () => {
  const chained = xOrigWsrvTransformUrl(YOUMIND_JPG, { width: 560, quality: 78 });
  const url = new URL(chained);
  assert.equal(
    url.searchParams.get("url"),
    "pbs.twimg.com/media/HRu3ie-bwAATJ-v?format=jpg&name=orig",
  );
  const fallback = url.searchParams.get("errorredirect");
  assert.ok(fallback, "fallback present");
  const fallbackUrl = new URL(fallback);
  assert.equal(fallbackUrl.searchParams.get("url"), "cms-assets.youmind.com/media/1788942288291_1ovagz_HRu3ie-bwAATJ-v.jpg");
  assert.equal(fallbackUrl.searchParams.get("w"), "560");

  // Non-YouMind URLs keep the single-origin shape (no errorredirect).
  const plain = xOrigWsrvTransformUrl("https://example.com/x.jpg", { width: 320 });
  assert.ok(!plain.includes("errorredirect"));
  assert.equal(new URL(plain).searchParams.get("url"), "example.com/x.jpg");
});

test("wsrvPassthroughUrl: no w/output/q params — original bytes only", () => {
  const url = new URL(wsrvPassthroughUrl(YOUMIND_JPG));
  assert.equal(url.searchParams.get("url"), "cms-assets.youmind.com/media/1788942288291_1ovagz_HRu3ie-bwAATJ-v.jpg");
  for (const dead of ["w", "output", "q", "we"]) {
    assert.equal(url.searchParams.get(dead), null);
  }
});

// ── Source-assertion wiring guards (TS files can't be imported here) ──

test("img.ts routes rawTransformUrl through the dual-origin core", () => {
  const src = readFileSync("src/lib/img.ts", "utf8");
  assert.match(src, /from "\.\/img-xorig-core\.mjs"/);
  assert.match(src, /xOrigWsrvTransformUrl/);
  assert.match(src, /originalBytesUrl/);
});

test("SmartImg keeps /lab-images + imageMogr2 + /uploads out of the wsrv path", () => {
  // Regression guard for the 2026-08-30 cost fix — P1 must not widen scope.
  const src = readFileSync("src/components/SmartImg.tsx", "utf8");
  assert.match(src, /startsWith\("\/lab-images\/"\)/);
  assert.match(src, /imageMogr2/);
});
