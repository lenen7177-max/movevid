import { describe, expect, it } from "vitest";
import { resolveCommonConfig, resolveWebCommonConfig } from "../app-config";
import { mergeCreditsConfigs, normalizeCreditsConfig } from "../credits";

describe("platform credit config", () => {
  it("normalizes the shipped web credit config without throwing", () => {
    // Regression: a disabled signup grant with amount 0 passed type checks but threw at runtime.
    expect(() => normalizeCreditsConfig(resolveWebCommonConfig().credits)).not.toThrow();
  });

  it("keeps credits on platform config instead of common config", () => {
    expect("credits" in resolveCommonConfig()).toBe(false);
    expect(resolveWebCommonConfig().credits).toBeDefined();
  });

  it("drops packages from disabled credit configs", () => {
    const merged = mergeCreditsConfigs([
      {
        enabled: false,
        packages: [
          {
            id: "starter",
            amount: 100,
            web: {
              provider: "stripe",
              test: { providerPriceId: "price_web_test" },
              prod: { providerPriceId: "price_web_prod" },
              currency: "usd",
              amountCents: 499,
            },
          },
        ],
      },
    ]);

    expect(merged.enabled).toBe(false);
    expect(normalizeCreditsConfig(merged).packages).toEqual([]);
  });
});
