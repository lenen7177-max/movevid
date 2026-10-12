import { describe, expect, it } from "vitest";
import {
  CN_PHONE_NUMBER_REGEX,
  getVisibleUserContact,
  getVisibleUserEmail,
  getVisibleUserName,
  isPhoneCompatibilityEmail,
  isPhoneUser,
  normalizePhoneDigits,
} from "../phone";

describe("phone validation", () => {
  it("accepts a valid CN mobile number", () => {
    expect(CN_PHONE_NUMBER_REGEX.test("+8613800138000")).toBe(true);
  });

  it.each([
    ["missing + prefix", "8613800138000"],
    ["wrong country code", "+8513800138000"],
    ["too short", "+861380013800"],
    ["too long", "+86138001380000"],
    ["contains letters", "+8613800aaa138"],
  ])("rejects %s", (_, input) => {
    expect(CN_PHONE_NUMBER_REGEX.test(input)).toBe(false);
  });

  it("normalizePhoneDigits strips non-digits", () => {
    expect(normalizePhoneDigits("+86 138-0013-8000")).toBe("8613800138000");
    expect(normalizePhoneDigits("(+86) 138 0013 8000")).toBe("8613800138000");
  });
});

describe("isPhoneCompatibilityEmail", () => {
  it("matches the expected placeholder shape", () => {
    expect(isPhoneCompatibilityEmail("phone-abcdef0123456789@phone-auth.invalid")).toBe(true);
    expect(isPhoneCompatibilityEmail("PHONE-ABCDEF0123456789@phone-auth.invalid")).toBe(true);
  });

  it("treats real emails and malformed strings as non-placeholder", () => {
    expect(isPhoneCompatibilityEmail("user@example.com")).toBe(false);
    // Legacy plaintext-digits shape is intentionally no longer accepted — blocks stale matches.
    expect(isPhoneCompatibilityEmail("phone-8613800138000@phone-auth.invalid")).toBe(false);
    expect(isPhoneCompatibilityEmail("phone-short@phone-auth.invalid")).toBe(false);
    expect(isPhoneCompatibilityEmail(null)).toBe(false);
    expect(isPhoneCompatibilityEmail(undefined)).toBe(false);
    expect(isPhoneCompatibilityEmail("")).toBe(false);
  });
});

describe("visible user identity helpers", () => {
  it("hides compatibility emails but returns real ones", () => {
    expect(getVisibleUserEmail({ email: "real@example.com" })).toBe("real@example.com");
    expect(getVisibleUserEmail({ email: "phone-abcdef0123456789@phone-auth.invalid" })).toBeNull();
    expect(getVisibleUserEmail({ email: null })).toBeNull();
  });

  it("isPhoneUser only requires a phone number", () => {
    expect(
      isPhoneUser({
        email: "phone-abcdef0123456789@phone-auth.invalid",
        phoneNumber: "+8613800138000",
      }),
    ).toBe(true);
    expect(isPhoneUser({ email: null, phoneNumber: "+8613800138000" })).toBe(true);
    expect(
      isPhoneUser({
        email: "real@example.com",
        phoneNumber: "+8613800138000",
      }),
    ).toBe(true);
    expect(isPhoneUser({ email: "phone-abcdef0123456789@phone-auth.invalid" })).toBe(false);
  });

  it("getVisibleUserName replaces phone-number names with stable generated names", () => {
    const phoneUser = {
      id: "user_123",
      name: "+8613800138000",
      email: "phone-abcdef0123456789@phone-auth.invalid",
      phoneNumber: "+8613800138000",
    };

    const first = getVisibleUserName(phoneUser);
    const second = getVisibleUserName(phoneUser);

    expect(first).toMatch(/^User [0-9A-Z]{6}$/);
    expect(first).toBe(second);
    expect(first).not.toBe("+8613800138000");
    expect(getVisibleUserName({ ...phoneUser, name: "Ada" })).toBe("Ada");
  });

  it("getVisibleUserContact prefers real email then falls back to phone", () => {
    expect(
      getVisibleUserContact({
        email: "real@example.com",
        phoneNumber: "+8613800138000",
      }),
    ).toBe("real@example.com");
    expect(
      getVisibleUserContact({
        email: "phone-abcdef0123456789@phone-auth.invalid",
        phoneNumber: "+8613800138000",
      }),
    ).toBe("+8613800138000");
    expect(getVisibleUserContact({ email: null, phoneNumber: null })).toBeNull();
  });
});
