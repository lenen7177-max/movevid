import {
  resolveCheckoutPolicyDecision,
  type CheckoutPolicyBillingStatusLike,
  type CheckoutPolicyDecision,
  type CheckoutPolicyPriceLike,
} from "@repo/app-config/membership";

type BillingStatusWithDomains = CheckoutPolicyBillingStatusLike & {
  billingDomains?: {
    web: CheckoutPolicyBillingStatusLike;
  };
};

export function getWebBillingDomain(
  billingStatus: BillingStatusWithDomains | null | undefined,
): CheckoutPolicyBillingStatusLike | null {
  return billingStatus?.billingDomains?.web ?? billingStatus ?? null;
}

/**
 * Web subscription upgrades are only supported through the same provider that
 * owns the current subscription, and waffo has no upgrade API at all.
 */
export function isWebUpgradeUnavailable(
  billingProvider: string | null,
  targetProvider: string | null,
) {
  return targetProvider !== billingProvider || billingProvider === "waffo";
}

export function resolveWebCheckoutPolicyDecision(
  billingStatus: BillingStatusWithDomains | null | undefined,
  targetPrice: CheckoutPolicyPriceLike | null,
): CheckoutPolicyDecision {
  return resolveCheckoutPolicyDecision(getWebBillingDomain(billingStatus), targetPrice);
}
