import { describe, expect, it } from "vitest";
import { hashNamespacedValue, toHex } from "../hash";

describe("toHex", () => {
  it("converts an ArrayBuffer to lowercase hex", () => {
    expect(toHex(new Uint8Array([0, 15, 16, 255]).buffer)).toBe("000f10ff");
  });
});

describe("hashNamespacedValue", () => {
  it("normalizes whitespace and casing", async () => {
    await expect(hashNamespacedValue(" User@Example.com ", "email", "secret")).resolves.toBe(
      await hashNamespacedValue("user@example.com", "email", "secret"),
    );
  });

  it("separates namespaces and secrets", async () => {
    const emailHash = await hashNamespacedValue("value", "email", "secret");
    const phoneHash = await hashNamespacedValue("value", "phone", "secret");
    const otherSecretHash = await hashNamespacedValue("value", "email", "other-secret");

    expect(emailHash).not.toBe(phoneHash);
    expect(emailHash).not.toBe(otherSecretHash);
  });

  it("returns null for empty values", async () => {
    await expect(hashNamespacedValue("   ", "email", "secret")).resolves.toBeNull();
    await expect(hashNamespacedValue(null, "email", "secret")).resolves.toBeNull();
  });
});
