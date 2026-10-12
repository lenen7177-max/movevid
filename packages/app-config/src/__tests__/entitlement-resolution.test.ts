import { describe, expect, it } from "vitest";
import type { SubscriptionStatus } from "../payments/web";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "../payments/web";
import { resolveCurrentMembershipEntitlement } from "../membership";
import type { BillingInterval, PriceType } from "../types";

type SubscriptionRecord = {
  status: SubscriptionStatus;
  planId: string;
  priceId: string;
  provider: "stripe" | "revenuecat";
  updatedAt: Date;
};

type PurchaseRecord = {
  status: "succeeded" | "pending" | "failed" | "refunded";
  planId: string;
  priceId: string;
  provider: "stripe" | "revenuecat";
  updatedAt: Date;
};

type ResolvedPrice = {
  id: string;
  planId: string;
  priceType: PriceType;
  interval: BillingInterval | null;
};

const TEST_ACTIVE_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(
  ACTIVE_SUBSCRIPTION_STATUSES,
);

function resolveCurrentEntitlement(input: {
  subscriptions: SubscriptionRecord[];
  purchases: PurchaseRecord[];
  findPriceById: (priceId: string) => ResolvedPrice | undefined;
}) {
  return resolveCurrentMembershipEntitlement({
    subscriptions: input.subscriptions,
    purchases: input.purchases,
    activeSubscriptionStatuses: TEST_ACTIVE_SUBSCRIPTION_STATUSES,
    findPriceById: input.findPriceById,
  });
}

// ---------------------------------------------------------------------------
// Test price catalog
// ---------------------------------------------------------------------------

const PRICES: Record<string, ResolvedPrice> = {
  w_monthly: { id: "w_monthly", planId: "pro", priceType: "subscription", interval: "month" },
  w_yearly: { id: "w_yearly", planId: "pro", priceType: "subscription", interval: "year" },
  w_lifetime: { id: "w_lifetime", planId: "pro", priceType: "lifetime", interval: null },
  n_monthly: { id: "n_monthly", planId: "pro", priceType: "subscription", interval: "month" },
  n_yearly: { id: "n_yearly", planId: "pro", priceType: "subscription", interval: "year" },
  n_lifetime: { id: "n_lifetime", planId: "pro", priceType: "lifetime", interval: null },
};

function findPriceById(priceId: string): ResolvedPrice | undefined {
  return PRICES[priceId];
}

function sub(
  provider: "stripe" | "revenuecat",
  priceId: string,
  status: SubscriptionStatus,
  updatedAt: Date,
): SubscriptionRecord {
  return { status, planId: "pro", priceId, provider, updatedAt };
}

function purchase(
  provider: "stripe" | "revenuecat",
  priceId: string,
  status: PurchaseRecord["status"],
  updatedAt: Date,
): PurchaseRecord {
  return { status, planId: "pro", priceId, provider, updatedAt };
}

const T1 = new Date("2025-01-01");
const T2 = new Date("2025-06-01");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveCurrentEntitlement — cross-platform scenarios", () => {
  it("1.1 no subscriptions, no purchases => free/none", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [],
      purchases: [],
      findPriceById,
    });
    expect(result).toEqual({ tier: "free", source: "none", planId: null, priceId: null });
  });

  it("1.2 one active Web-Monthly => monthly/subscription", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("stripe", "w_monthly", "active", T1)],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("monthly");
    expect(result.source).toBe("subscription");
  });

  it("1.3 one active Native-Monthly => monthly/subscription", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("revenuecat", "n_monthly", "active", T1)],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("monthly");
    expect(result.source).toBe("subscription");
  });

  it("1.4 one active Web-Yearly => yearly/subscription", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("stripe", "w_yearly", "active", T1)],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("yearly");
    expect(result.source).toBe("subscription");
  });

  it("1.5 one active Native-Yearly => yearly/subscription", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("revenuecat", "n_yearly", "active", T1)],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("yearly");
    expect(result.source).toBe("subscription");
  });

  it("1.6 one Web-Lifetime purchase => lifetime/lifetime", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [],
      purchases: [purchase("stripe", "w_lifetime", "succeeded", T1)],
      findPriceById,
    });
    expect(result.tier).toBe("lifetime");
    expect(result.source).toBe("lifetime");
  });

  it("1.7 one Native-Lifetime purchase => lifetime/lifetime", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [],
      purchases: [purchase("revenuecat", "n_lifetime", "succeeded", T1)],
      findPriceById,
    });
    expect(result.tier).toBe("lifetime");
    expect(result.source).toBe("lifetime");
  });

  it("1.8 W-Monthly(active) + N-Yearly(active) => yearly wins", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [
        sub("stripe", "w_monthly", "active", T1),
        sub("revenuecat", "n_yearly", "active", T2),
      ],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("yearly");
    expect(result.source).toBe("subscription");
    expect(result.priceId).toBe("n_yearly");
  });

  it("1.9 N-Monthly(active) + W-Yearly(active) => yearly wins", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [
        sub("revenuecat", "n_monthly", "active", T1),
        sub("stripe", "w_yearly", "active", T2),
      ],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("yearly");
    expect(result.priceId).toBe("w_yearly");
  });

  it("1.10 W-Monthly(active) + N-Lifetime(succeeded) => lifetime wins", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("stripe", "w_monthly", "active", T1)],
      purchases: [purchase("revenuecat", "n_lifetime", "succeeded", T2)],
      findPriceById,
    });
    expect(result.tier).toBe("lifetime");
    expect(result.source).toBe("lifetime");
  });

  it("1.11 N-Yearly(active) + W-Lifetime(succeeded) => lifetime wins", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("revenuecat", "n_yearly", "active", T1)],
      purchases: [purchase("stripe", "w_lifetime", "succeeded", T2)],
      findPriceById,
    });
    expect(result.tier).toBe("lifetime");
    expect(result.source).toBe("lifetime");
  });

  it("1.12 W-Monthly(canceled) => free/none", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("stripe", "w_monthly", "canceled", T1)],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("free");
    expect(result.source).toBe("none");
  });

  it("1.13 W-Monthly(canceled) + N-Yearly(active) => yearly", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [
        sub("stripe", "w_monthly", "canceled", T1),
        sub("revenuecat", "n_yearly", "active", T2),
      ],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("yearly");
    expect(result.priceId).toBe("n_yearly");
  });

  it("1.14 W-Monthly(active, older) + W-Yearly(active, newer) => yearly", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [
        sub("stripe", "w_monthly", "active", T1),
        sub("stripe", "w_yearly", "active", T2),
      ],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("yearly");
    expect(result.priceId).toBe("w_yearly");
  });

  it("1.15 W-Monthly(trialing) => monthly/subscription (trialing is active)", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("stripe", "w_monthly", "trialing", T1)],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("monthly");
    expect(result.source).toBe("subscription");
  });

  it("1.16 N-Lifetime(refunded) => free/none", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [],
      purchases: [purchase("revenuecat", "n_lifetime", "refunded", T1)],
      findPriceById,
    });
    expect(result.tier).toBe("free");
    expect(result.source).toBe("none");
  });

  it("1.17 W-Monthly(past_due) => free/none (past_due not in ACTIVE set)", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("stripe", "w_monthly", "past_due", T1)],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("free");
    expect(result.source).toBe("none");
  });

  it("1.18 same-tier tie-break: W-Monthly(older) + N-Monthly(newer) => N wins", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [
        sub("stripe", "w_monthly", "active", T1),
        sub("revenuecat", "n_monthly", "active", T2),
      ],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("monthly");
    expect(result.priceId).toBe("n_monthly");
  });

  it("8.2 lifetime + active subscription => lifetime wins", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("stripe", "w_yearly", "active", T2)],
      purchases: [purchase("revenuecat", "n_lifetime", "succeeded", T1)],
      findPriceById,
    });
    expect(result.tier).toBe("lifetime");
    expect(result.source).toBe("lifetime");
  });

  it("8.3 refunded lifetime + active yearly => yearly wins", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("stripe", "w_yearly", "active", T2)],
      purchases: [purchase("revenuecat", "n_lifetime", "refunded", T1)],
      findPriceById,
    });
    expect(result.tier).toBe("yearly");
    expect(result.source).toBe("subscription");
  });

  it("8.5 price not found in catalog => subscription ignored", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [sub("stripe", "unknown_price", "active", T1)],
      purchases: [],
      findPriceById,
    });
    expect(result.tier).toBe("free");
    expect(result.source).toBe("none");
  });

  it("8.6 multiple lifetime purchases => tie-break by updatedAt", () => {
    const result = resolveCurrentEntitlement({
      subscriptions: [],
      purchases: [
        purchase("stripe", "w_lifetime", "succeeded", T1),
        purchase("revenuecat", "n_lifetime", "succeeded", T2),
      ],
      findPriceById,
    });
    expect(result.tier).toBe("lifetime");
    expect(result.priceId).toBe("n_lifetime");
  });
});
