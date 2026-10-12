import { describe, expect, it } from "vitest";
import { normalizePaymentsConfig } from "../payments/web";

describe("web provider price environments", () => {
  it("selects the test provider price ID", () => {
    const plans = normalizePaymentsConfig(
      {
        plans: [
          {
            id: "pro",
            prices: [
              {
                id: "monthly",
                provider: "stripe",
                test: {
                  providerPriceId: "price_test_monthly",
                },
                prod: {
                  providerPriceId: "price_prod_monthly",
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
      "test",
    );

    expect(plans[0]?.prices[0]?.providerPriceId).toBe("price_test_monthly");
  });

  it("selects the prod provider price ID", () => {
    const plans = normalizePaymentsConfig(
      {
        plans: [
          {
            id: "pro",
            prices: [
              {
                id: "monthly",
                provider: "stripe",
                test: {
                  providerPriceId: "price_test_monthly",
                },
                prod: {
                  providerPriceId: "price_prod_monthly",
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

    expect(plans[0]?.prices[0]?.providerPriceId).toBe("price_prod_monthly");
  });

  it("throws when the selected environment provider price ID is empty", () => {
    expect(() =>
      normalizePaymentsConfig(
        {
          plans: [
            {
              id: "pro",
              prices: [
                {
                  id: "monthly",
                  provider: "stripe",
                  test: {
                    providerPriceId: "price_test_monthly",
                  },
                  prod: {
                    providerPriceId: "",
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
      ),
    ).toThrow("[payments] prod.providerPriceId is required for price monthly.");
  });

  it("rejects duplicate provider price IDs in the selected environment", () => {
    expect(() =>
      normalizePaymentsConfig(
        {
          plans: [
            {
              id: "pro",
              prices: [
                {
                  id: "monthly",
                  provider: "stripe",
                  test: {
                    providerPriceId: "price_duplicate",
                  },
                  prod: {
                    providerPriceId: "price_prod_monthly",
                  },
                  currency: "usd",
                  amountCents: 1000,
                  priceType: "subscription",
                  interval: "month",
                  status: "active",
                },
                {
                  id: "yearly",
                  provider: "stripe",
                  test: {
                    providerPriceId: "price_duplicate",
                  },
                  prod: {
                    providerPriceId: "price_prod_yearly",
                  },
                  currency: "usd",
                  amountCents: 10000,
                  priceType: "subscription",
                  interval: "year",
                  status: "active",
                },
              ],
            },
          ],
        },
        "test",
      ),
    ).toThrow("[payments] Duplicate provider price id: stripe:price_duplicate");
  });
});
