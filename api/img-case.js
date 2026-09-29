/**
 * Same-origin proxy for store-backed case images (/images/cases/*).
 *
 * The B2 store bucket is PRIVATE (owner preference, 2026-09-29), so the
 * plain Vercel rewrite cannot fetch it — B2 rejects anonymous reads and
 * its download tokens live ≤1 day. This function SigV4-presigns a GET
 * against B2's S3 endpoint with the read credentials from env, streams
 * the bytes through, and stamps long edge-cache headers so each object
 * is fetched from B2 roughly once per edge region.
 *
 * Vercel env (dashboard):
 *   B2_STORE_KEY_ID / B2_STORE_APP_KEY — read-capable key scoped to the store
 *
 * Route: vercel.json rewrites /images/cases/:path* → here with ?key=:path*.
 */
const BUCKET = "taostudio-img";
const REGION = "us-east-005";
const HOST = `s3.${REGION}.backblazeb2.com`;

const ALLOWED_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

function hmac(key, data) {
  return require("node:crypto").createHmac("sha256", key).update(data).digest();
}
function sha256hex(data) {
  return require("node:crypto").createHash("sha256").update(data).digest("hex");
}

/** SigV4 query-presigned GET URL (single object, short expiry). */
function presignGet(key, expires = 60) {
  const crypto = require("node:crypto");
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${REGION}/s3/aws4_request`;
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${process.env.B2_STORE_KEY_ID}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalRequest = [
    "GET",
    `/${BUCKET}/${key}`,
    params.toString(),
    `host:${HOST}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256hex(canonicalRequest),
  ].join("\n");
  const signing = hmac(hmac(hmac(hmac("AWS4" + process.env.B2_STORE_APP_KEY, dateStamp), REGION), "s3"), "aws4_request");
  params.set("X-Amz-Signature", crypto.createHmac("sha256", signing).update(stringToSign).digest("hex"));
  return `https://${HOST}/${BUCKET}/${key}?${params.toString()}`;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  const key = String(req.query.key || "");
  if (!ALLOWED_KEY.test(key)) {
    res.statusCode = 400;
    return res.end("bad key");
  }
  const storeKey = `cases/${key}`;
  try {
    const upstream = await fetch(presignGet(storeKey), { signal: AbortSignal.timeout(20000) });
    if (!upstream.ok || !upstream.body) {
      res.statusCode = upstream.status === 404 ? 404 : 502;
      return res.end();
    }
    res.setHeader(
      "Cache-Control",
      "public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400",
    );
    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    if (ct) res.setHeader("Content-Type", ct);
    res.statusCode = 200;
    return res.send(upstream.body);
  } catch {
    res.statusCode = 504;
    return res.end();
  }
};
