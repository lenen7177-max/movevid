import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
} from "@repo/app-config/payments/web";
import {
  evaluateCheckoutDecision,
  resolveCurrentMembershipEntitlement,
  type CurrentEntitlement,
  type MembershipPurchaseRecord,
  type PriceInfo,
} from "@repo/app-config/membership";

/**
 * Minimal subscription record required by server entitlement resolution.
 */
type SubscriptionRecord = {
  status: SubscriptionStatus;
  planId: string;
  priceId: string;
  updatedAt: Date;
};

/**
 * Resolved price details required by entitlement logic.
 */
type ResolvedPrice = PriceInfo & {
  id: string;
  planId: string;
};

const billingActiveSubscriptionStatuses: ReadonlySet<string> = new Set(
  ACTIVE_SUBSCRIPTION_STATUSES,
);

/**
 * Resolves current entitlement using server billing status semantics.
 */
function resolveCurrentEntitlement(input: {
  subscriptions: SubscriptionRecord[];
  purchases: MembershipPurchaseRecord[];
  findPriceById: (priceId: string) => ResolvedPrice | undefined;
}): CurrentEntitlement {
  return resolveCurrentMembershipEntitlement({
    subscriptions: input.subscriptions,
    purchases: input.purchases,
    activeSubscriptionStatuses: billingActiveSubscriptionStatuses,
    findPriceById: input.findPriceById,
  });
}

export { evaluateCheckoutDecision, resolveCurrentEntitlement };
