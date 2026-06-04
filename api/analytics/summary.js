import {
  authorizeAnalyticsSummaryRequest,
  handleAnalyticsSummary,
} from "../../src/server/site-analytics-core.mjs";

export const config = {
  maxDuration: 20,
};

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    return sendJson(res, 204, {});
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return sendJson(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use GET" },
    });
  }

  const authorized = await authorizeAnalyticsSummaryRequest({
    authorization: req.headers.authorization || "",
    env: process.env,
    fetchImpl: fetch,
  });
  if (!authorized) {
    return sendJson(res, 401, {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Invalid analytics credentials" },
    });
  }

  try {
    const days = Number(req.query?.days || 30);
    const result = await handleAnalyticsSummary({
      days,
      env: process.env,
      fetchImpl: fetch,
    });
    return sendJson(res, result.ok ? 200 : 503, result);
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: {
        code: "SUMMARY_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
