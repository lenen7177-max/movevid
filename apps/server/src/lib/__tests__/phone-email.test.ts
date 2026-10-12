import assert from "node:assert/strict";
import test from "node:test";
import { buildPhoneCompatibilityEmail } from "../phone-email";

const SECRET = "test-secret-please-rotate";
const PHONE_1 = "+8613800138000";
const PHONE_2 = "+8613800138001";

test("buildPhoneCompatibilityEmail produces the expected placeholder shape", () => {
  const email = buildPhoneCompatibilityEmail(PHONE_1, SECRET);
  assert.match(email, /^phone-[0-9a-f]{16}@phone-auth\.invalid$/);
});

test("buildPhoneCompatibilityEmail does not leak the raw phone digits", () => {
  const email = buildPhoneCompatibilityEmail(PHONE_1, SECRET);
  assert.equal(email.includes("13800138000"), false);
  assert.equal(email.includes("8613800138000"), false);
});

test("buildPhoneCompatibilityEmail is deterministic for the same input", () => {
  assert.equal(
    buildPhoneCompatibilityEmail(PHONE_1, SECRET),
    buildPhoneCompatibilityEmail(PHONE_1, SECRET),
  );
});

test("buildPhoneCompatibilityEmail produces distinct digests for different numbers", () => {
  assert.notEqual(
    buildPhoneCompatibilityEmail(PHONE_1, SECRET),
    buildPhoneCompatibilityEmail(PHONE_2, SECRET),
  );
});

test("buildPhoneCompatibilityEmail changes with the secret", () => {
  assert.notEqual(
    buildPhoneCompatibilityEmail(PHONE_1, "secret-a"),
    buildPhoneCompatibilityEmail(PHONE_1, "secret-b"),
  );
});

test("buildPhoneCompatibilityEmail throws on an empty secret", () => {
  assert.throws(() => buildPhoneCompatibilityEmail(PHONE_1, ""));
});
