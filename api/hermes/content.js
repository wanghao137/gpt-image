import { Buffer } from "node:buffer";
import {
  getHermesApiKey,
  handleHermesContentRequest,
  HermesContentError,
  isAuthorizedHermesRequest,
} from "../../src/server/hermes-content-core.mjs";

export const config = {
  maxDuration: 30,
};

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body != null) {
    if (typeof req.body === "string") return JSON.parse(req.body || "{}");
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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
    const expectedKey = getHermesApiKey(process.env);
    if (!isAuthorizedHermesRequest(req, expectedKey)) {
      return sendJson(res, 401, {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Invalid Hermes API key" },
      });
    }

    const body = await readJsonBody(req);
    const result = await handleHermesContentRequest({ body, env: process.env, fetchImpl: fetch });
    return sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return sendJson(res, 400, {
        ok: false,
        error: { code: "BAD_JSON", message: "Request body must be valid JSON" },
      });
    }
    const status = error instanceof HermesContentError ? error.status : 500;
    return sendJson(res, status, {
      ok: false,
      error: {
        code: error instanceof HermesContentError ? error.code : "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof HermesContentError ? error.details : undefined,
      },
    });
  }
}
