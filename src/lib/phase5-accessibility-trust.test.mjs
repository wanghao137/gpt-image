import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { routeAnnouncement } from "./route-accessibility.mjs";
import { sourceDisplayLabel } from "./source-label.mjs";

test("route announcements cover primary and long-tail routes", () => {
  assert.equal(routeAnnouncement("/"), "首页已加载");
  assert.equal(routeAnnouncement("/cases"), "案例库已加载");
  assert.equal(routeAnnouncement("/case/example"), "案例详情已加载");
  assert.equal(routeAnnouncement("/template/example"), "模板详情已加载");
});

test("source labels normalize URLs and community handles without hiding editorial labels", () => {
  assert.equal(sourceDisplayLabel("https://github.com/example/repo"), "GitHub");
  assert.equal(sourceDisplayLabel("Community collected via @artist"), "社区整理 · @artist");
  assert.equal(sourceDisplayLabel("真实案例提炼", "https://github.com/example/repo"), "真实案例提炼");
  assert.equal(sourceDisplayLabel("", "https://x.com/example"), "X");
});

test("phase 5 keeps SSG content visible and exposes accessibility contracts", async () => {
  const [indexHtml, rootLayout, header, filterBar, homePage, aboutPage, imageHelpers, casesPage] = await Promise.all([
    readFile(new URL("../../index.html", import.meta.url), "utf8"),
    readFile(new URL("../layouts/RootLayout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/Header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/FilterBar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../pages/HomePage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../pages/AboutPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("./img.ts", import.meta.url), "utf8"),
    readFile(new URL("../pages/CasesPage.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(indexHtml, /boot-overlay/);
  assert.match(rootLayout, /aria-live="polite"/);
  assert.match(rootLayout, /\.focus\(\{ preventScroll: true \}\)/);
  assert.match(header, /useFocusTrap<HTMLElement>\(mobileOpen\)/);
  assert.match(header, /event\.key === "Escape"/);
  assert.match(filterBar, /aria-pressed=\{active\}/);
  assert.match(homePage, /loading=\{priority \? "eager" : "lazy"\}/);
  assert.match(aboutPage, /隐私与访问统计/);
  assert.match(aboutPage, /来源与授权提示/);
  assert.match(imageHelpers, /if \(src\.startsWith\("\/"\)\) return src/);
  assert.match(casesPage, /const searchParamsKey = sp\.toString\(\)/);
  assert.doesNotMatch(casesPage, /\}, \[sp\]\)/);
});
