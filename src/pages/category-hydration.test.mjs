import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("category page hydrates from the SSG-serialized first frame", async () => {
  const src = await readFile(new URL("./CategoryPage.tsx", import.meta.url), "utf8");

  // The client bundle tree-shakes ALL_CASES away, so without the serialized
  // slice the first client render is the EMPTY STATE over the baked 24-card
  // wall — React #425/#418 teardown on every direct category load (measured
  // live on taostudioai.com 2026-09-12). The SSG must serialize the exact
  // first frame and the client must read it before React mutates the markup.
  assert.match(src, /data-payload=\{JSON\.stringify\(/, "SSG must serialize the first frame");
  assert.match(src, /readBootstrapPayload/, "client must read the payload in the initializer");
  assert.match(src, /BOOTSTRAP_PAGE_SIZE/);
  // first client frame renders the payload slice — ssgList is [] on the client
  assert.match(src, /if \(bootstrapForMeta\) \{[\s\S]{0,220}bootstrapForMeta\.items/);
  // display counts track the payload total, not the slice length
  assert.match(src, /\{totalCases\} 个案例/);
  // deep scroll-restore must not expand visibleCount into the invisible padding
  assert.match(src, /restoreId=\{clientList\.length \? restoreId : undefined\}/);
});
