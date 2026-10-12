import { describe, expect, it } from "vitest";
import {
  evaluateCheckoutDecision,
  resolveMembershipTier,
  compareMembershipTiers,
  isValidUpgrade,
  resolveCheckoutPolicyDecision,
  type CurrentEntitlement,
  type MembershipTier,
  type EntitlementSource,
} from "../membership";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ent(
  tier: MembershipTier,
  source: EntitlementSource,
  planId: string | null = null,
  priceId: string | null = null,
): CurrentEntitlement {
  return { tier, source, planId, priceId };
}

// ---------------------------------------------------------------------------
// 1. resolveMembershipTier
// ---------------------------------------------------------------------------

describe("resolveMembershipTier", () => {
  it("returns 'monthly' for subscription with month interval", () => {
    expect(resolveMembershipTier({ priceType: "subscription", interval: "month" })).toBe("monthly");
  });

  it("returns 'yearly' for subscription with year interval", () => {
    expect(resolveMembershipTier({ priceType: "subscription", interval: "year" })).toBe("yearly");
  });

  it("returns 'lifetime' for lifetime price", () => {
    expect(resolveMembershipTier({ priceType: "lifetime", interval: null })).toBe("lifetime");
  });

  it("throws when subscription has no interval", () => {
    expect(() => resolveMembershipTier({ priceType: "subscription", interval: null })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. compareMembershipTiers
// ---------------------------------------------------------------------------

describe("compareMembershipTiers", () => {
  it("free < monthly < yearly < lifetime", () => {
    expect(compareMembershipTiers("free", "monthly")).toBeLessThan(0);
    expect(compareMembershipTiers("monthly", "yearly")).toBeLessThan(0);
    expect(compareMembershipTiers("yearly", "lifetime")).toBeLessThan(0);
  });

  it("same tier returns 0", () => {
    expect(compareMembershipTiers("monthly", "monthly")).toBe(0);
    expect(compareMembershipTiers("lifetime", "lifetime")).toBe(0);
  });

  it("higher tier compared to lower returns positive", () => {
    expect(compareMembershipTiers("lifetime", "free")).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. isValidUpgrade
// ---------------------------------------------------------------------------

describe("isValidUpgrade", () => {
  it("monthly -> yearly is valid", () => {
    expect(isValidUpgrade("monthly", "yearly")).toBe(true);
  });

  it("monthly -> lifetime is valid", () => {
    expect(isValidUpgrade("monthly", "lifetime")).toBe(true);
  });

  it("yearly -> lifetime is valid", () => {
    expect(isValidUpgrade("yearly", "lifetime")).toBe(true);
  });

  it("free -> monthly is valid", () => {
    expect(isValidUpgrade("free", "monthly")).toBe(true);
  });

  it("monthly -> monthly is NOT valid (same tier)", () => {
    expect(isValidUpgrade("monthly", "monthly")).toBe(false);
  });

  it("yearly -> monthly is NOT valid (downgrade)", () => {
    expect(isValidUpgrade("yearly", "monthly")).toBe(false);
  });

  it("lifetime -> yearly is NOT valid", () => {
    expect(isValidUpgrade("lifetime", "yearly")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. evaluateCheckoutDecision
// ---------------------------------------------------------------------------

describe("evaluateCheckoutDecision", () => {
  // ── From free ──

  it("2.1 free -> monthly sub = checkout/ok", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("free", "none"),
      targetPrice: { priceType: "subscription", interval: "month" },
    });
    expect(result).toEqual({ action: "checkout", reason: "ok" });
  });

  it("2.2 free -> yearly sub = checkout/ok", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("free", "none"),
      targetPrice: { priceType: "subscription", interval: "year" },
    });
    expect(result).toEqual({ action: "checkout", reason: "ok" });
  });

  it("2.3 free -> lifetime = checkout/ok", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("free", "none"),
      targetPrice: { priceType: "lifetime", interval: null },
    });
    expect(result).toEqual({ action: "checkout", reason: "ok" });
  });

  // ── From monthly subscription ──

  it("2.4 monthly/sub -> yearly sub = upgrade/subscription_upgrade", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("monthly", "subscription", "pro", "pro_monthly"),
      targetPrice: { priceType: "subscription", interval: "year" },
    });
    expect(result).toEqual({ action: "upgrade", reason: "subscription_upgrade" });
  });

  it("2.5 monthly/sub -> lifetime = checkout/ok", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("monthly", "subscription", "pro", "pro_monthly"),
      targetPrice: { priceType: "lifetime", interval: null },
    });
    expect(result).toEqual({ action: "checkout", reason: "ok" });
  });

  it("2.6 monthly/sub -> monthly sub = deny/downgrade_or_same_tier", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("monthly", "subscription", "pro", "pro_monthly"),
      targetPrice: { priceType: "subscription", interval: "month" },
    });
    expect(result).toEqual({ action: "deny", reason: "downgrade_or_same_tier" });
  });

  // ── From yearly subscription ──

  it("2.7 yearly/sub -> monthly sub = deny/downgrade_or_same_tier", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("yearly", "subscription", "pro", "pro_yearly"),
      targetPrice: { priceType: "subscription", interval: "month" },
    });
    expect(result).toEqual({ action: "deny", reason: "downgrade_or_same_tier" });
  });

  it("2.8 yearly/sub -> yearly sub = deny/downgrade_or_same_tier", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("yearly", "subscription", "pro", "pro_yearly"),
      targetPrice: { priceType: "subscription", interval: "year" },
    });
    expect(result).toEqual({ action: "deny", reason: "downgrade_or_same_tier" });
  });

  it("2.9 yearly/sub -> lifetime = checkout/ok", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("yearly", "subscription", "pro", "pro_yearly"),
      targetPrice: { priceType: "lifetime", interval: null },
    });
    expect(result).toEqual({ action: "checkout", reason: "ok" });
  });

  // ── From lifetime ──

  it("2.10 lifetime -> monthly = deny/already_lifetime", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("lifetime", "lifetime", "pro", "pro_lifetime"),
      targetPrice: { priceType: "subscription", interval: "month" },
    });
    expect(result).toEqual({ action: "deny", reason: "already_lifetime" });
  });

  it("2.11 lifetime -> yearly = deny/already_lifetime", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("lifetime", "lifetime", "pro", "pro_lifetime"),
      targetPrice: { priceType: "subscription", interval: "year" },
    });
    expect(result).toEqual({ action: "deny", reason: "already_lifetime" });
  });

  it("2.12 lifetime -> lifetime = deny/already_lifetime", () => {
    const result = evaluateCheckoutDecision({
      currentEntitlement: ent("lifetime", "lifetime", "pro", "pro_lifetime"),
      targetPrice: { priceType: "lifetime", interval: null },
    });
    expect(result).toEqual({ action: "deny", reason: "already_lifetime" });
  });
});

// ---------------------------------------------------------------------------
// 5. resolveCheckoutPolicyDecision (UI layer)
// ---------------------------------------------------------------------------

describe("resolveCheckoutPolicyDecision", () => {
  it("6.1 target price is null => disabled/downgrade_or_same_tier", () => {
    const result = resolveCheckoutPolicyDecision(null, null);
    expect(result).toEqual({ action: "disabled", reason: "downgrade_or_same_tier" });
  });

  it("6.2 target price is the current active price => disabled/current_price", () => {
    const result = resolveCheckoutPolicyDecision(
      {
        currentEntitlement: { tier: "monthly", source: "subscription" },
        activePrice: { id: "price_monthly" },
      },
      { id: "price_monthly", priceType: "subscription", interval: "month" },
    );
    expect(result).toEqual({ action: "disabled", reason: "current_price" });
  });

  it("6.3 free user -> monthly = checkout/ok", () => {
    const result = resolveCheckoutPolicyDecision(null, {
      id: "price_monthly",
      priceType: "subscription",
      interval: "month",
    });
    expect(result).toEqual({ action: "checkout", reason: "ok" });
  });

  it("6.4 monthly user -> yearly = upgrade/subscription_upgrade", () => {
    const result = resolveCheckoutPolicyDecision(
      {
        currentEntitlement: { tier: "monthly", source: "subscription" },
        activePrice: { id: "price_monthly" },
      },
      { id: "price_yearly", priceType: "subscription", interval: "year" },
    );
    expect(result).toEqual({ action: "upgrade", reason: "subscription_upgrade" });
  });

  it("6.5 lifetime user -> anything = disabled/already_lifetime", () => {
    const result = resolveCheckoutPolicyDecision(
      {
        currentEntitlement: { tier: "lifetime", source: "lifetime" },
        activePrice: { id: "price_lifetime" },
      },
      { id: "price_monthly", priceType: "subscription", interval: "month" },
    );
    expect(result).toEqual({ action: "disabled", reason: "already_lifetime" });
  });

  it("deny action is mapped to disabled", () => {
    const result = resolveCheckoutPolicyDecision(
      {
        currentEntitlement: { tier: "yearly", source: "subscription" },
        activePrice: { id: "price_yearly" },
      },
      { id: "price_monthly", priceType: "subscription", interval: "month" },
    );
    expect(result.action).toBe("disabled");
    expect(result.reason).toBe("downgrade_or_same_tier");
  });
});
