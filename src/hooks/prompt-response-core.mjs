export function parsePromptPayload(text) {
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

  return data.prompt;
}

export async function readPromptResponse(response, url = "Prompt") {
  if (!response.ok) throw new Error(`Prompt load failed: HTTP ${response.status}`);

  const contentType = response.headers?.get?.("content-type") ?? "";
  if (contentType && !/\bjson\b/i.test(contentType)) {
    throw new Error("Prompt file returned non-JSON content");
  }

  const text = await response.text();
  try {
    return parsePromptPayload(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prompt load failed";
    throw new Error(`${message}: ${url}`);
  }
}
