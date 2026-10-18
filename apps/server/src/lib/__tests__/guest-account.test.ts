import assert from "node:assert/strict";
import test from "node:test";
import { buildGuestEmail, isGuestEmail, isGuestUser } from "../guest-account";

test("buildGuestEmail uses the reserved, undeliverable guest domain", () => {
  const email = buildGuestEmail();
  assert.match(email, /^guest-[0-9a-f]{32}@guest\.invalid$/);
  assert.notEqual(buildGuestEmail(), email);
});

test("isGuestEmail only matches guest placeholders", () => {
  assert.equal(isGuestEmail(buildGuestEmail()), true);
  assert.equal(isGuestEmail("GUEST-1@GUEST.INVALID"), true);
  assert.equal(isGuestEmail("someone@example.com"), false);
  assert.equal(isGuestEmail("someone@notguest.invalid"), false);
  assert.equal(isGuestEmail(null), false);
});

test("isGuestUser reads the anonymous plugin flag", () => {
  assert.equal(isGuestUser({ isAnonymous: true }), true);
  assert.equal(isGuestUser({ isAnonymous: false }), false);
  assert.equal(isGuestUser({ email: "a@b.co" }), false);
  assert.equal(isGuestUser(undefined), false);
});
