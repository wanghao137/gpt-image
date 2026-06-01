import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sync = readFileSync(new URL("./sync.mjs", import.meta.url), "utf8");
const hermes = readFileSync(new URL("../src/server/hermes-content-core.mjs", import.meta.url), "utf8");
const adminTypes = readFileSync(new URL("../src/admin/types.ts", import.meta.url), "utf8");
const publicTypes = readFileSync(new URL("../src/types.ts", import.meta.url), "utf8");

test("manual case and template timestamps survive the publishing pipeline", () => {
  assert.match(sync, /inferContentDate/);
  assert.match(sync, /createdAt:\s*inferContentDate\(item\)/);
  assert.match(sync, /createdAt:\s*c\.createdAt/);
  assert.match(sync, /sortTemplatesForDisplay/);
});

test("Hermes content API accepts createdAt for cases and templates", () => {
  assert.match(hermes, /createdAt:\s*optionalText\(item,\s*"createdAt"\)/);
  assert.match(hermes, /createdAt:\s*templateCreatedAt/);
});

test("admin and public types expose template createdAt", () => {
  assert.match(adminTypes, /createdAt\?:\s*string/);
  assert.match(publicTypes, /export interface PromptTemplate[\s\S]*createdAt\?:\s*string/);
});
