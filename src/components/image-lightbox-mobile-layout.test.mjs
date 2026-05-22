import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./ImageLightbox.tsx", import.meta.url), "utf8");

test("mobile lightbox toolbar stacks caption above actions", () => {
  assert.match(source, /flex-col/);
  assert.match(source, /sm:flex-row/);
  assert.match(source, /sm:items-start/);
});

test("mobile lightbox action labels cannot wrap into vertical text", () => {
  assert.match(source, /whitespace-nowrap/);
  assert.match(source, /min-w-0/);
  assert.match(source, /shrink-0/);
});
