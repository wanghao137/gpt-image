import { Buffer } from "node:buffer";
import {
  getHermesApiKey,
  handleHermesContentRequest,
  HermesContentError,
  isAuthorizedHermesRequest,
} from "../../src/server/hermes-content-core.mjs";

/**
 * Hermes content write endpoint.
 *
 * SECURITY MODEL (read before changing):
 *   - This is a network-reachable WRITE endpoint. It holds a repo-scoped
 *     GitHub token (HERMES_GITHUB_TOKEN) and commits to `main`, which triggers
 *     a production redeploy. Treat any change here as high-risk.
 *   - AuthN: a single static bearer key (HERMES_ADMIN_API_KEY), compared in
 *     constant time. There is no per-user identity — anyone holding the key can
 *     write. Rotate the key if it leaks; there is no other revocation.
 *   - AuthZ surface is intentionally narrow: only data/manual/*.json and
 *     public/uploads/** can be written (enforced in hermes-content-core).
 *   - Defence-in-depth: request body size, uploads count + combined size, and
 *     a best-effort per-instance rate limit (below) bound abuse from a leaked
 *     key until it can be rotated. This is NOT a substitute for key secrecy.
 *   - Limitations: the in-memory limiter only covers a single warm serverless
 *     instance; it is a speed bump, not a global quota. A durable limiter
 *     (KV/Redis) + IP allowlist would be the next step if this endpoint ever
 *     handles untrusted volume.
 */

export const config = {
  maxDuration: 30,
};

// Reject bodies larger than this before parsing — a single case + a few images
// stays well under this; anything larger is almost certainly abuse.
const MAX_BODY_BYTES = 28 * 1024 * 1024;

// Best-effort, per-instance fixed-window rate limit keyed by client IP.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const rateBuckets = new Map();

function clientIp(req) {
  const fwd = req.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

/** Returns true when the caller is within budget; records the hit. */
function withinRateLimit(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { start: now, count: 1 });
    // Opportunistic cleanup so the map can't grow unbounded on a long-lived
    // instance.
    if (rateBuckets.size > 1000) {
      for (const [key, value] of rateBuckets) {
        if (now - value.start >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key);
      }
    }
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

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
      if (Buffer.byteLength(req.body) > MAX_BODY_BYTES) {
        throw new HermesContentError(413, "Request body too large", "BODY_TOO_LARGE");
      }
      return JSON.parse(req.body || "{}");
    }
    return req.body;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw new HermesContentError(413, "Request body too large", "BODY_TOO_LARGE");
    }
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

  if (!withinRateLimit(req)) {
    res.setHeader("Retry-After", String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    return sendJson(res, 429, {
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too many requests, slow down" },
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
