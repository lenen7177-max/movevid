import { describe, expect, it } from "vitest";
import type { billingPurchase, billingSubscription } from "@/db/schema/payments";
import { resolveBillingStatus } from "../billing-status";

type SubscriptionRecord = typeof billingSubscription.$inferSelect;
type PurchaseRecord = typeof billingPurchase.$inferSelect;

const USER = { userId: "user_1" };
const T1 = new Date("2026-01-01T00:00:00Z");

function subscription(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: "sub_internal_1",
    userId: USER.userId,
    provider: "stripe",
    providerSubscriptionId: "sub_provider_1",
    providerCustomerId: "cus_provider_1",
    planId: "pro",
    priceId: "monthly",
    status: "active",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    startedAt: T1,
    endedAt: null,
    providerEventAt: null,
    createdAt: T1,
    updatedAt: T1,
    ...overrides,
  };
}

function purchase(overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: "pur_internal_1",
    userId: USER.userId,
    provider: "stripe",
    providerPaymentIntentId: "pi_provider_1",
    planId: "lifetime",
    priceId: "lifetime",
    status: "succeeded",
    paidAt: T1,
    providerEventAt: null,
    createdAt: T1,
    updatedAt: T1,
    ...overrides,
  };
}

describe("resolveBillingStatus", () => {
  it("returns free/none when there are no records", () => {
    const status = resolveBillingStatus({ user: USER, subscriptions: [], purchases: [] });

    expect(status.userId).toBe(USER.userId);
    expect(status.billingProvider).toBeNull();
    expect(status.canManageBilling).toBe(false);
    expect(status.currentEntitlement).toEqual({ tier: "free", source: "none" });

    const web = status.billingDomains.web;
    expect(web.provider).toBeNull();
    expect(web.canManageBilling).toBe(false);
    expect(web.currentEntitlement).toEqual({ tier: "free", source: "none" });
    expect(web.subscription).toBeNull();
    expect(web.lifetimePurchase).toBeNull();
  });

  it("ignores subscriptions to prices the catalog no longer sells", () => {
    // The shipped catalog sells credit packs only, so stored subscriptions grant nothing.
    const status = resolveBillingStatus({
      user: USER,
      subscriptions: [subscription(), subscription({ id: "sub_internal_2", priceId: "yearly" })],
      purchases: [],
    });

    expect(status.currentEntitlement).toEqual({ tier: "free", source: "none" });
  });

  it("ignores purchases of prices the web catalog does not sell", () => {
    // The shipped web catalog sells subscriptions only; add a lifetime price to sell one.
    const status = resolveBillingStatus({
      user: USER,
      subscriptions: [],
      purchases: [purchase()],
    });

    expect(status.billingDomains.web.currentEntitlement).toEqual({ tier: "free", source: "none" });
  });
});
