import { describe, expect, it } from "vitest";
import { getClientIp, normalizeHeaderValue } from "../ip";

describe("normalizeHeaderValue", () => {
  it("trims strings and returns null for empty values", () => {
    expect(normalizeHeaderValue("  value  ")).toBe("value");
    expect(normalizeHeaderValue("   ")).toBeNull();
    expect(normalizeHeaderValue(null)).toBeNull();
  });
});

describe("getClientIp", () => {
  it("prefers Cloudflare IP, then forwarded IP, then real IP", () => {
    expect(
      getClientIp(
        new Headers({
          "cf-connecting-ip": " 203.0.113.1 ",
          "x-forwarded-for": "203.0.113.2, 203.0.113.3",
          "x-real-ip": "203.0.113.4",
        }),
      ),
    ).toBe("203.0.113.1");

    expect(
      getClientIp(
        new Headers({
          "x-forwarded-for": "203.0.113.2, 203.0.113.3",
          "x-real-ip": "203.0.113.4",
        }),
      ),
    ).toBe("203.0.113.2");

    expect(getClientIp(new Headers({ "x-real-ip": "203.0.113.4" }))).toBe("203.0.113.4");
  });
});
