import assert from "node:assert/strict";
import test from "node:test";
import { isTransientApimartError, withApimartRetry } from "../apimart";

const timeout = () =>
  Object.assign(new Error("The operation was aborted due to timeout"), {
    name: "TimeoutError",
  });

test("isTransientApimartError retries timeouts, dropped connections and 429/5xx only", () => {
  assert.equal(isTransientApimartError(timeout()), true);
  assert.equal(
    isTransientApimartError(new Error("The operation was aborted due to timeout")),
    true,
  );
  assert.equal(isTransientApimartError(new TypeError("Network connection lost.")), true);
  assert.equal(isTransientApimartError(new Error("apimart_upload_502: Bad Gateway")), true);
  assert.equal(isTransientApimartError(new Error("apimart_asset_429: Too many requests")), true);
  assert.equal(
    isTransientApimartError(new Error("apimart_upload_400: invalid image content")),
    false,
  );
  assert.equal(
    isTransientApimartError(new Error("apimart_submit_402: Insufficient account balance.")),
    false,
  );
  assert.equal(isTransientApimartError("timeout"), false);
});

test("withApimartRetry succeeds after transient failures", async () => {
  let calls = 0;
  const result = await withApimartRetry(
    "test",
    async () => {
      calls += 1;
      if (calls < 3) throw timeout();
      return "ok";
    },
    [0, 0],
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("withApimartRetry gives up after the last retry", async () => {
  let calls = 0;
  await assert.rejects(
    withApimartRetry(
      "test",
      async () => {
        calls += 1;
        throw timeout();
      },
      [0, 0],
    ),
    /aborted due to timeout/,
  );
  assert.equal(calls, 3);
});

test("withApimartRetry doesn't retry a request APIMart rejected", async () => {
  let calls = 0;
  await assert.rejects(
    withApimartRetry(
      "test",
      async () => {
        calls += 1;
        throw new Error("apimart_upload_400: invalid image content");
      },
      [0, 0],
    ),
  );
  assert.equal(calls, 1);
});
