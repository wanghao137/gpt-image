import test from "node:test";
import assert from "node:assert/strict";
import collectHandler from "../../api/analytics/collect.js";

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(payload = "") {
      this.body = payload;
    },
  };
}

test("analytics collect rejects oversized parser-provided string bodies", async () => {
  const res = createResponse();
  const oversizedBody = JSON.stringify({ path: "/", extra: "x".repeat(16 * 1024) });

  await collectHandler({ method: "POST", headers: {}, body: oversizedBody }, res);

  assert.equal(res.statusCode, 413);
  assert.equal(JSON.parse(res.body).error.code, "BODY_TOO_LARGE");
});
