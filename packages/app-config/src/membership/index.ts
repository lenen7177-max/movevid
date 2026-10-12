import { resolveCommonConfig } from "../app-config";
import type {
  BillingInterval,
  MembershipCatalogConfig,
  MembershipPlanConfig,
  MembershipPresentationKind,
  MembershipPriceConfig,
  MembershipTier,
  PlanStatus,
  PriceType,
} from "../types";

export type {
  MembershipCatalogConfig,
  MembershipPlanConfig,
  MembershipPresentationKind,
  MembershipPriceConfig,
  MembershipTier,
} from "../types";

/** Source of the currently effective membership entitlement. */
export type EntitlementSource = "none" | "subscription" | "lifetime" | "admin_trial";

/** Current effective membership state for one user or device. */
export type MembershipEntitlement = {
  tier: MembershipTier;
  source: EntitlementSource;
  planId: string | null;
  priceId: string | null;
};

/** Backward-compatible name for existing payment callers. */
export type CurrentEntitlement = MembershipEntitlement;

/** Price information required for entitlement and presentation resolution. */
export type PriceInfo = {
  tier?: MembershipTier;
  presentationKind?: MembershipPresentationKind;
  priceType: PriceType;
  interval: BillingInterval | null;
};

/** Normalized canonical membership price. */
export type NormalizedMembershipPrice = {
  id: string;
  planId: string;
  tier: Exclude<MembershipTier, "free">;
  priceType: PriceType;
  interval: BillingInterval | null;
  status: PlanStatus;
  presentationKind: MembershipPresentationKind;
};

/** Normalized canonical membership plan. */
export type NormalizedMembershipPlan = {
  id: string;
  status: PlanStatus;
  prices: NormalizedMembershipPrice[];
};

/** Minimal subscription record required by membership entitlement resolution. */
export type MembershipSubscriptionRecord = {
  status: string;
  planId: string;
  priceId: string;
  updatedAt: Date;
};

/** Minimal purchase record required by membership entitlement resolution. */
export type MembershipPurchaseRecord = {
  status: "succeeded" | "pending" | "failed" | "refunded";
  planId: string;
  priceId: string;
  updatedAt: Date;
};

type EntitlementCandidate = {
  tier: MembershipTier;
  source: Exclude<EntitlementSource, "none">;
  planId: string;
  priceId: string;
  updatedAt: Date;
};

/** Ranking system used to compare membership entitlements. */
export const MEMBERSHIP_TIER_RANK: Record<MembershipTier, number> = {
  free: 0,
  monthly: 1,
  yearly: 2,
  lifetime: 3,
} as const;

/** Actions that can be taken for a checkout decision. */
export type CheckoutAction = "checkout" | "upgrade" | "deny";

/** Reasons for checkout decision outcomes. */
export const CHECKOUT_DECISION_REASONS = [
  "ok",
  "already_lifetime",
  "downgrade_or_same_tier",
  "subscription_upgrade",
  "managed_by_other_channel",
] as const;

export type CheckoutDecisionReason = (typeof CHECKOUT_DECISION_REASONS)[number];

/** Complete checkout decision with action and reason. */
export type CheckoutDecision = {
  action: CheckoutAction;
  reason: CheckoutDecisionReason;
};

/** Shared presentation metadata for one membership price variant. */
export type PaymentPresentation = {
  kind: MembershipPresentationKind;
  titleKey: "monthly" | "yearly" | "lifetime";
  billingNoteKey: "flexible_cancel_anytime" | "billed_annually" | "one_time_purchase";
  suffixKey: "per_month" | "per_year" | null;
  badgeKey: "best_value" | null;
  title: string;
  billingNote: string;
  suffix: string | null;
  badge: string | null;
};

/** Backward-compatible name for existing payment callers. */
export type PaymentPresentationKind = MembershipPresentationKind;

/** Shared presentation presets used by payment UIs. */
export const PAYMENT_PRESENTATIONS: Record<MembershipPresentationKind, PaymentPresentation> = {
  monthly: {
    kind: "monthly",
    titleKey: "monthly",
    billingNoteKey: "flexible_cancel_anytime",
    suffixKey: "per_month",
    badgeKey: null,
    title: "Monthly",
    billingNote: "Flexible, cancel anytime",
    suffix: "/mo",
    badge: null,
  },
  yearly: {
    kind: "yearly",
    titleKey: "yearly",
    billingNoteKey: "billed_annually",
    suffixKey: "per_year",
    badgeKey: "best_value",
    title: "Yearly",
    billingNote: "Billed annually",
    suffix: "/yr",
    badge: "BEST VALUE",
  },
  lifetime: {
    kind: "lifetime",
    titleKey: "lifetime",
    billingNoteKey: "one_time_purchase",
    suffixKey: null,
    badgeKey: null,
    title: "Lifetime",
    billingNote: "One-time purchase",
    suffix: null,
    badge: null,
  },
} as const;

/** Runtime membership catalog resolved from common app config. */
export const membershipCatalogConfig: MembershipCatalogConfig = resolveCommonConfig().membership;

function assertStatus(status: PlanStatus | undefined, field: string) {
  if (status && status !== "active" && status !== "archived") {
    throw new Error(`[membership] Invalid status for ${field}.`);
  }
}

function assertMembershipPrice(price: MembershipPriceConfig, planId: string) {
  if (!price.id) {
    throw new Error(`[membership] Price id is required for plan ${planId}.`);
  }
  if (price.priceType === "subscription" && !price.interval) {
    throw new Error(`[membership] Subscription price ${price.id} requires an interval.`);
  }
  if (price.priceType === "lifetime" && price.interval) {
    throw new Error(`[membership] Lifetime price ${price.id} must not include an interval.`);
  }
  if (price.interval && price.interval !== "month" && price.interval !== "year") {
    throw new Error(`[membership] Invalid interval for price ${price.id}.`);
  }
  assertStatus(price.status, `price ${price.id}`);
}

function normalizeMembershipPrice(
  plan: MembershipPlanConfig,
  price: MembershipPriceConfig,
): NormalizedMembershipPrice {
  assertMembershipPrice(price, plan.id);

  return {
    id: price.id,
    planId: plan.id,
    tier: price.tier,
    priceType: price.priceType,
    interval: price.priceType === "subscription" ? (price.interval as BillingInterval) : null,
    status: price.status ?? "active",
    presentationKind: price.presentationKind ?? price.tier,
  };
}

/** Validates and normalizes the canonical Membership Catalog. */
export function normalizeMembershipCatalogConfig(
  input: MembershipCatalogConfig,
): NormalizedMembershipPlan[] {
  const planIds = new Set<string>();
  const priceIds = new Set<string>();

  return input.plans.map((plan) => {
    if (!plan.id) {
      throw new Error("[membership] Plan id is required.");
    }
    if (planIds.has(plan.id)) {
      throw new Error(`[membership] Duplicate plan id: ${plan.id}`);
    }
    planIds.add(plan.id);
    assertStatus(plan.status, `plan ${plan.id}`);

    const prices = plan.prices.map((price) => {
      const normalized = normalizeMembershipPrice(plan, price);
      if (priceIds.has(normalized.id)) {
        throw new Error(`[membership] Duplicate price id: ${normalized.id}`);
      }
      priceIds.add(normalized.id);
      return normalized;
    });

    return {
      id: plan.id,
      status: plan.status ?? "active",
      prices,
    };
  });
}

/** Returns normalized membership plans from the supplied or runtime catalog. */
export function listNormalizedMembershipPlans(
  input: MembershipCatalogConfig = membershipCatalogConfig,
): NormalizedMembershipPlan[] {
  return normalizeMembershipCatalogConfig(input);
}

/** Finds a canonical membership plan by internal plan ID. */
export function findMembershipPlanById(
  planId: string,
  input: MembershipCatalogConfig = membershipCatalogConfig,
) {
  return listNormalizedMembershipPlans(input).find((plan) => plan.id === planId);
}

/** Finds a canonical membership price by globally unique price ID. */
export function findMembershipPriceById(
  priceId: string,
  input: MembershipCatalogConfig = membershipCatalogConfig,
) {
  for (const plan of listNormalizedMembershipPlans(input)) {
    const price = plan.prices.find((item) => item.id === priceId);
    if (price) {
      return price;
    }
  }
  return undefined;
}

/** Resolves membership tier from one price-like value. */
export function resolveMembershipTier(price: PriceInfo): MembershipTier {
  if (price.tier) {
    return price.tier;
  }

  if (price.priceType === "lifetime") {
    return "lifetime";
  }

  if (!price.interval) {
    throw new Error("[membership] Subscription prices require an interval.");
  }

  return price.interval === "year" ? "yearly" : "monthly";
}

/** Compares two membership tiers. */
export function compareMembershipTiers(tierA: MembershipTier, tierB: MembershipTier): number {
  return MEMBERSHIP_TIER_RANK[tierA] - MEMBERSHIP_TIER_RANK[tierB];
}

/** Checks whether a target tier is a strict upgrade over the current tier. */
export function isValidUpgrade(currentTier: MembershipTier, targetTier: MembershipTier): boolean {
  return compareMembershipTiers(targetTier, currentTier) > 0;
}

function pickHigherCandidate(
  current: EntitlementCandidate | null,
  next: EntitlementCandidate,
): EntitlementCandidate {
  if (!current) {
    return next;
  }

  const currentRank = MEMBERSHIP_TIER_RANK[current.tier];
  const nextRank = MEMBERSHIP_TIER_RANK[next.tier];
  if (nextRank > currentRank) {
    return next;
  }

  if (nextRank < currentRank) {
    return current;
  }

  return next.updatedAt > current.updatedAt ? next : current;
}

/** Resolves current membership entitlement from subscription and purchase records. */
export function resolveCurrentMembershipEntitlement(input: {
  subscriptions: MembershipSubscriptionRecord[];
  purchases: MembershipPurchaseRecord[];
  activeSubscriptionStatuses: ReadonlySet<string>;
  findPriceById?: (priceId: string) => PriceInfo | undefined;
}): MembershipEntitlement {
  const findPriceById = input.findPriceById ?? findMembershipPriceById;
  let topCandidate: EntitlementCandidate | null = null;

  for (const subscription of input.subscriptions) {
    if (!input.activeSubscriptionStatuses.has(subscription.status)) {
      continue;
    }

    const price = findPriceById(subscription.priceId);
    if (!price) {
      continue;
    }

    topCandidate = pickHigherCandidate(topCandidate, {
      tier: resolveMembershipTier(price),
      source: "subscription",
      planId: subscription.planId,
      priceId: subscription.priceId,
      updatedAt: subscription.updatedAt,
    });
  }

  for (const purchase of input.purchases) {
    if (purchase.status !== "succeeded") {
      continue;
    }

    const price = findPriceById(purchase.priceId);
    if (!price || price.priceType !== "lifetime") {
      continue;
    }

    topCandidate = pickHigherCandidate(topCandidate, {
      tier: resolveMembershipTier(price),
      source: "lifetime",
      planId: purchase.planId,
      priceId: purchase.priceId,
      updatedAt: purchase.updatedAt,
    });
  }

  if (!topCandidate) {
    return {
      tier: "free",
      source: "none",
      planId: null,
      priceId: null,
    };
  }

  return {
    tier: topCandidate.tier,
    source: topCandidate.source,
    planId: topCandidate.planId,
    priceId: topCandidate.priceId,
  };
}

/** Backward-compatible name for existing payment callers. */
export const resolveCurrentEntitlement = resolveCurrentMembershipEntitlement;

/** Resolves the shared checkout decision from the current entitlement and target price. */
export function evaluateCheckoutDecision(input: {
  currentEntitlement: MembershipEntitlement;
  targetPrice: PriceInfo;
}): CheckoutDecision {
  if (input.currentEntitlement.source === "admin_trial") {
    return { action: "checkout", reason: "ok" };
  }

  const currentTier = input.currentEntitlement.tier;
  const targetTier = resolveMembershipTier(input.targetPrice);

  if (currentTier === "lifetime") {
    return {
      action: "deny",
      reason: "already_lifetime",
    };
  }

  if (!isValidUpgrade(currentTier, targetTier)) {
    return {
      action: "deny",
      reason: "downgrade_or_same_tier",
    };
  }

  if (
    input.currentEntitlement.source === "subscription" &&
    input.targetPrice.priceType === "subscription"
  ) {
    return {
      action: "upgrade",
      reason: "subscription_upgrade",
    };
  }

  return {
    action: "checkout",
    reason: "ok",
  };
}

/** Minimal price shape required by the checkout policy. */
export type CheckoutPolicyPriceLike = {
  id: string;
  tier?: MembershipTier;
  presentationKind?: MembershipPresentationKind;
  priceType: PriceType;
  interval: BillingInterval | null;
};

/** Minimal billing status shape required by the checkout policy. */
export type CheckoutPolicyBillingStatusLike = {
  currentEntitlement?: {
    tier: MembershipTier;
    source: EntitlementSource;
  } | null;
  activePrice?: {
    id: string;
  } | null;
};

/** Checkout policy reasons including the frontend-only current-price state. */
export type CheckoutPolicyReason = CheckoutDecisionReason | "current_price";

/** Checkout policy actions including the frontend-only disabled state. */
export type CheckoutPolicyAction = CheckoutAction | "disabled";

/** Complete checkout policy decision used by UI modules. */
export type CheckoutPolicyDecision = {
  action: CheckoutPolicyAction;
  reason: CheckoutPolicyReason;
};

/** Resolves the UI-level checkout policy decision from billing status and target price. */
export function resolveCheckoutPolicyDecision(
  billingStatus: CheckoutPolicyBillingStatusLike | null | undefined,
  targetPrice: CheckoutPolicyPriceLike | null,
): CheckoutPolicyDecision {
  if (!targetPrice) {
    return {
      action: "disabled",
      reason: "downgrade_or_same_tier",
    };
  }

  if (billingStatus?.activePrice?.id === targetPrice.id) {
    return {
      action: "disabled",
      reason: "current_price",
    };
  }

  const decision = evaluateCheckoutDecision({
    currentEntitlement: {
      tier: billingStatus?.currentEntitlement?.tier ?? "free",
      source: billingStatus?.currentEntitlement?.source ?? "none",
      planId: null,
      priceId: billingStatus?.activePrice?.id ?? null,
    },
    targetPrice,
  });

  return decision.action === "deny"
    ? {
        action: "disabled",
        reason: decision.reason,
      }
    : decision;
}

/** Resolves stable presentation metadata from one price-like value. */
export function resolvePaymentPresentation(price: PriceInfo): PaymentPresentation {
  const tier = resolveMembershipTier(price);
  if (tier === "free") {
    throw new Error("[membership] Free Membership has no payment presentation.");
  }

  return PAYMENT_PRESENTATIONS[price.presentationKind ?? tier];
}
