import assert from "node:assert/strict";
import test from "node:test";
import { classifyVideoError } from "../errors";

test("classifyVideoError flags content safety review rejections as content_blocked", () => {
  assert.equal(
    classifyVideoError(
      "Your request did not pass content safety review. Please adjust your prompt or input files and try again.",
    ),
    "content_blocked",
  );
});

test("classifyVideoError keeps the existing moderation mappings", () => {
  assert.equal(
    classifyVideoError("Blocked by a specific content policy (e.g. public figures)"),
    "content_blocked",
  );
  assert.equal(classifyVideoError("InputImageSensitiveContentDetected"), "photo_rejected");
  assert.equal(classifyVideoError("asset_review_failed:right: rejected"), "photo_right_rejected");
  assert.equal(classifyVideoError("timeout"), "timeout");
});

test("classifyVideoError leaves unknown errors unclassified", () => {
  assert.equal(classifyVideoError("provider_failed"), null);
  assert.equal(classifyVideoError(null), null);
});

test("classifyVideoError tells provider outages apart from rejected photos", () => {
  assert.equal(
    classifyVideoError(
      "asset_review_failed:left: A temporary problem occurred while processing your request. Please try again in a moment.",
    ),
    "service_unavailable",
  );
  assert.equal(
    classifyVideoError(
      "asset_review_failed:right: A temporary connection problem occurred. Please try again in a moment.",
    ),
    "service_unavailable",
  );
  assert.equal(
    classifyVideoError("The operation was aborted due to timeout"),
    "service_unavailable",
  );
  assert.equal(
    classifyVideoError(
      "apimart_submit_402: Insufficient account balance. Please top up and try again.",
    ),
    "service_unavailable",
  );
  assert.equal(classifyVideoError("submit_interrupted"), "service_unavailable");
});

test("classifyVideoError still reports real photo rejections from asset review", () => {
  assert.equal(
    classifyVideoError(
      "asset_review_failed:left: Your request did not pass content safety review. Please adjust your prompt or input files and try again.",
    ),
    "photo_left_rejected",
  );
});
