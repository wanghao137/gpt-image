import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parsePromptBundle,
  parsePromptPayload,
  readPromptResponse,
} from "./prompt-response-core.mjs";

const usePromptSource = readFileSync(new URL("./usePrompt.ts", import.meta.url), "utf8");

test("parsePromptPayload rejects HTML fallback before JSON parsing", () => {
  assert.throws(
    () => parsePromptPayload("<!DOCTYPE html><html><body>SPA fallback</body></html>"),
    /HTML fallback/,
  );
});

test("parsePromptPayload returns prompt from valid JSON", () => {
  assert.equal(parsePromptPayload(JSON.stringify({ id: "403", prompt: "hello" })), "hello");
});

test("parsePromptBundle exposes official bilingual prompt fields", () => {
  assert.deepEqual(
    parsePromptBundle(
      JSON.stringify({ id: "403", prompt: "hello", promptEn: "hello", promptZh: "你好" }),
    ),
    { prompt: "hello", promptEn: "hello", promptZh: "你好" },
  );
});

test("parsePromptBundle keeps legacy prompt files compatible", () => {
  assert.deepEqual(parsePromptBundle(JSON.stringify({ id: "403", prompt: "hello" })), {
    prompt: "hello",
    promptEn: "hello",
    promptZh: "",
  });
});

test("readPromptResponse rejects non-JSON content types", async () => {
  const response = new Response("<!DOCTYPE html>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

  await assert.rejects(
    () => readPromptResponse(response, "/data/prompts/missing.json"),
    /non-JSON/,
  );
});

test("usePrompt routes prompt fetches through the guarded response reader", () => {
  assert.match(usePromptSource, /readPromptBundleResponse/);
  assert.doesNotMatch(usePromptSource, /\.json\(\)\s+as\s+Promise<\{ prompt: string \}>/);
});
