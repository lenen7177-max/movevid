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
