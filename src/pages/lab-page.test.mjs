import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("/lab route is registered with the LabPage entry", () => {
  const src = readFileSync("src/routes.tsx", "utf8");
  assert.match(src, /path: "lab",\s*Component: LabPage/);
  assert.match(src, /import LabPage from "\.\/pages\/LabPage"/);
});

test("Header NAV links the 4K lab on desktop AND mobile (shared NAV array)", () => {
  const src = readFileSync("src/components/Header.tsx", "utf8");
  assert.match(src, /\{ to: "\/lab", label: "4K 实验室"/);
  // both nav surfaces iterate the same NAV array
  const maps = src.match(/NAV\.map/g) ?? [];
  assert.ok(maps.length >= 2, `expected NAV.map in desktop + mobile nav, found ${maps.length}`);
});

test("LabPage never statically imports the full registry", () => {
  const page = readFileSync("src/pages/LabPage.tsx", "utf8");
  const grid = readFileSync("src/components/LabGrid.tsx", "utf8");
  for (const src of [page, grid]) {
    assert.ok(!src.includes("data/manual/lab.json"), "client code must not import the full registry");
    assert.ok(!src.includes("data-lab-ssg"), "client code must not import the SSG-only loader");
  }
});

test("LabPage load-more pulls browse shards via loadLabBrowsePage", () => {
  const src = readFileSync("src/pages/LabPage.tsx", "utf8");
  assert.match(src, /loadLabBrowsePage/);
  assert.match(src, /LAB_HOME/);
});

test("LabGrid renders direct imageMogr2 thumbs with aspect-ratio placeholders", () => {
  const src = readFileSync("src/components/LabGrid.tsx", "utf8");
  assert.match(src, /item\.thumb/);
  assert.match(src, /aspectRatio/);
  assert.match(src, /\/lab\/\$\{item\.slug\}/);
});
