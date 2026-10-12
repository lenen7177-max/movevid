import { describe, expect, it } from "vitest";
import { SUPPORTED_SERVER_PAYMENT_PROVIDERS, SUPPORTED_WEB_PAYMENT_PROVIDERS } from "../types";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  normalizePaymentsConfig,
  SUBSCRIPTION_STATUSES,
} from "../payments/web";

describe("Creem web payments support", () => {
  it("includes creem in supported web and server payment providers", () => {
    expect(SUPPORTED_WEB_PAYMENT_PROVIDERS).toContain("creem");
    expect(SUPPORTED_SERVER_PAYMENT_PROVIDERS).toContain("creem");
  });

  it("normalizes creem-backed web prices without renaming providerPriceId", () => {
    const plans = normalizePaymentsConfig(
      {
        plans: [
          {
            id: "pro",
            prices: [
              {
                id: "monthly",
                provider: "creem",
                test: {
                  providerPriceId: "test_creem_monthly",
                },
                prod: {
                  providerPriceId: "prod_creem_monthly",
                },
                currency: "usd",
                amountCents: 1000,
                priceType: "subscription",
                interval: "month",
                status: "active",
              },
            ],
          },
        ],
      },
      "prod",
    );

    expect(plans[0]?.prices[0]).toMatchObject({
      provider: "creem",
      providerPriceId: "prod_creem_monthly",
    });
  });

  it("adds paused to subscription statuses but does not treat it as active", () => {
    expect(SUBSCRIPTION_STATUSES).toContain("paused");
    expect(ACTIVE_SUBSCRIPTION_STATUSES.has("paused")).toBe(false);
  });
});
