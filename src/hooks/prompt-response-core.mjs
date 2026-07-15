export function parsePromptBundle(text) {
  const body = String(text ?? "");
  const trimmed = body.trimStart();
  if (/^<(?:!doctype|html|\w+)/i.test(trimmed)) {
    throw new Error("Prompt file returned HTML fallback");
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("Prompt JSON is invalid");
  }

  if (!data || typeof data.prompt !== "string" || data.prompt.length === 0) {
    throw new Error("Prompt JSON is missing prompt");
  }

  return {
    prompt: data.prompt,
    promptEn: typeof data.promptEn === "string" && data.promptEn ? data.promptEn : data.prompt,
    promptZh: typeof data.promptZh === "string" && data.promptZh ? data.promptZh : "",
  };
}

export function parsePromptPayload(text) {
  return parsePromptBundle(text).prompt;
}

export async function readPromptBundleResponse(response, url = "Prompt") {
  if (!response.ok) throw new Error(`Prompt load failed: HTTP ${response.status}`);

  const contentType = response.headers?.get?.("content-type") ?? "";
  if (contentType && !/\bjson\b/i.test(contentType)) {
    throw new Error("Prompt file returned non-JSON content");
  }

  const text = await response.text();
  try {
    return parsePromptBundle(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prompt load failed";
    throw new Error(`${message}: ${url}`);
  }
}

export async function readPromptResponse(response, url = "Prompt") {
  return (await readPromptBundleResponse(response, url)).prompt;
}
