import {
  type NormalizedPlan,
  normalizePaymentsConfig,
  type PaymentsConfig,
  paymentsConfig,
} from "@repo/app-config/payments/web";
import type { ServerPaymentProviderKey } from "@repo/app-config";

type WebCatalogPrice = NormalizedPlan["prices"][number];
type BillingCatalogPrice = WebCatalogPrice;
type BillingCatalogPlan = NormalizedPlan;

/**
 * Normalized web checkout plans are loaded once and reused as read-only catalog data.
 */
const webConfig = normalizePaymentsConfig(paymentsConfig as PaymentsConfig);

/**
 * Returns all web-purchasable plans and active prices for client presentation.
 */
function listConfiguredPlans(): NormalizedPlan[] {
  return webConfig
    .filter((plan) => plan.status === "active")
    .map((plan) => ({
      ...plan,
      prices: plan.prices.filter((price) => price.status === "active"),
    }));
}

/**
 * Finds a web checkout plan by internal plan ID.
 */
function findPlanById(planId: string): NormalizedPlan | undefined {
  return webConfig.find((plan) => plan.id === planId);
}

/**
 * Finds a web checkout price by internal price ID.
 */
function findPriceById(priceId: string): WebCatalogPrice | undefined {
  for (const plan of webConfig) {
    const price = plan.prices.find((item) => item.id === priceId);
    if (price) return price;
  }
  return undefined;
}

/**
 * Finds a billing plan in the payment catalog.
 */
function findBillingPlanById(planId: string): BillingCatalogPlan | undefined {
  return findPlanById(planId);
}

/**
 * Finds a billing price in the payment catalog.
 */
function findBillingPriceById(priceId: string): BillingCatalogPrice | undefined {
  return findPriceById(priceId);
}

/**
 * Finds the billing price that matches a persisted provider billing record.
 */
function findBillingPriceForRecord(input: {
  provider: ServerPaymentProviderKey;
  planId: string;
  priceId: string;
}): BillingCatalogPrice | undefined {
  return findPriceById(input.priceId);
}

/**
 * Finds a price by provider-specific price ID.
 */
function findPriceByProviderPriceId(
  provider: ServerPaymentProviderKey,
  providerPriceId: string,
): WebCatalogPrice | undefined {
  for (const plan of webConfig) {
    const price = plan.prices.find(
      (item) => item.provider === provider && item.providerPriceId === providerPriceId,
    );
    if (price) return price;
  }
  return undefined;
}

export {
  findBillingPlanById,
  findBillingPriceById,
  findBillingPriceForRecord,
  findPlanById,
  findPriceById,
  findPriceByProviderPriceId,
  listConfiguredPlans,
};
