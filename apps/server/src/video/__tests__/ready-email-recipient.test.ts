import assert from "node:assert/strict";
import test from "node:test";
import { buildGuestEmail } from "../../lib/guest-account";
import { videoReadyRecipient, videoReadyUrl } from "../ready-email-recipient";

const base = { name: "Jamie", isAnonymous: false, deletedAt: null };

test("videoReadyRecipient emails accounts with a real address", () => {
  assert.deepEqual(videoReadyRecipient({ ...base, email: "jamie@example.com" }), {
    to: "jamie@example.com",
    name: "Jamie",
  });
});

test("videoReadyRecipient emails a guest renamed to their Stripe email", () => {
  // claimGuestAccount sets the Stripe email, isAnonymous false and the name from the local part.
  assert.deepEqual(
    videoReadyRecipient({
      email: "buyer@example.com",
      name: "",
      isAnonymous: false,
      deletedAt: null,
    }),
    { to: "buyer@example.com", name: "buyer" },
  );
});

test("videoReadyRecipient skips guests, placeholders and deleted accounts", () => {
  assert.equal(videoReadyRecipient({ ...base, email: buildGuestEmail() }), null);
  assert.equal(
    videoReadyRecipient({ ...base, email: "someone@example.com", isAnonymous: true }),
    null,
  );
  assert.equal(
    videoReadyRecipient({ ...base, email: "jamie@example.com", deletedAt: new Date() }),
    null,
  );
  assert.equal(
    videoReadyRecipient({ ...base, email: "phone-0123456789abcdef@phone-auth.invalid" }),
    null,
  );
  assert.equal(videoReadyRecipient({ ...base, email: "" }), null);
  assert.equal(videoReadyRecipient({ ...base, email: null }), null);
  assert.equal(videoReadyRecipient(undefined), null);
});

test("videoReadyUrl links the studio page for the job", () => {
  assert.equal(
    videoReadyUrl("https://example.com/", "abc-123"),
    "https://example.com/studio?job=abc-123",
  );
  assert.equal(videoReadyUrl("https://example.com", "a b"), "https://example.com/studio?job=a%20b");
});
