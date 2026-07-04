import { Buffer } from "node:buffer";
import { handleCollectPageView } from "../../src/server/site-analytics-core.mjs";

export const config = {
  maxDuration: 10,
};

const MAX_BODY_BYTES = 16 * 1024;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body != null) {
    if (typeof req.body === "string") {
      if (Buffer.byteLength(req.body) > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
      return JSON.parse(req.body || "{}");
    }
    return req.body;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 204, {});
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" },
    });
  }

  try {
    const body = await readJsonBody(req);
    const result = await handleCollectPageView({
      body,
      headers: req.headers,
      env: process.env,
      fetchImpl: fetch,
    });
    return sendJson(res, result.ok ? 202 : 202, result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return sendJson(res, 400, {
        ok: false,
        error: { code: "BAD_JSON", message: "Request body must be valid JSON" },
      });
    }
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return sendJson(res, 413, {
        ok: false,
        error: { code: "BODY_TOO_LARGE", message: "Request body too large" },
      });
    }
    return sendJson(res, 202, {
      ok: false,
      error: {
        code: "COLLECT_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
