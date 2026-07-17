import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const smartImg = readFileSync(new URL("./SmartImg.tsx", import.meta.url), "utf8");
const homePage = readFileSync(new URL("../pages/HomePage.tsx", import.meta.url), "utf8");
const vercelConfig = JSON.parse(
  readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"),
);

function headerValue(source, key) {
  const route = vercelConfig.headers.find((entry) => entry.source === source);
  assert.ok(route, `${source} header route is missing`);
  const header = route.headers.find((entry) => entry.key.toLowerCase() === key.toLowerCase());
  assert.ok(header, `${source} ${key} header is missing`);
  return header.value;
}

test("image and upload routes avoid long immutable caching", () => {
  for (const source of ["/images/(.*)", "/uploads/(.*)"]) {
    const cacheControl = headerValue(source, "Cache-Control");
    assert.equal(
      cacheControl,
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    );
    assert.doesNotMatch(cacheControl, /immutable/);
    assert.doesNotMatch(cacheControl, /31536000/);
  }
});

test("SmartImg retries image candidates once with a cache-busting query before surfacing an error", () => {
  assert.match(smartImg, /media\?: string/);
  assert.match(smartImg, /retryToken/);
  assert.match(smartImg, /retryDelayRef/);
  assert.match(smartImg, /appendRetryParam/);
  assert.match(smartImg, /appendRetryParamToSrcSet/);
  assert.match(smartImg, /setRetryToken\(\(current\)\s*=>\s*\(current === 0 \? 1 : current\)\)/);
  assert.match(smartImg, /if\s*\(\s*retryToken\s*===\s*0\s*\)/);
  assert.match(smartImg, /media=\{media\}/);
  assert.match(smartImg, /srcSet=\{retryWebpSrcSet\}/);
  assert.match(smartImg, /srcSet=\{media \? undefined : retryJpegSrcSet\}/);
  assert.match(smartImg, /TRANSPARENT_PIXEL_SRC/);
});

test("homepage keeps the hero strip dense while limiting high-priority images to visible hero work", () => {
  assert.match(homePage, /<HeroStrip cases=\{stripCases\} \/>/);
  assert.match(homePage, /priorityCount=\{0\}/);
  assert.doesNotMatch(homePage, /priorityCount=\{4\}/);
  assert.match(homePage, /priority:\s*true/);
  assert.match(homePage, /loading="eager"/);
  assert.match(homePage, /media="\(min-width: 1024px\)"/);
  assert.doesNotMatch(homePage, /limit=\{8\}/);
});
