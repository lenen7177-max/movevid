import { normalizePlanPricingConfig, type PricingConfigPlan } from "@repo/shared";
import { resolveWebCommonConfig } from "../app-config";
import {
  membershipCatalogConfig,
  normalizeMembershipCatalogConfig,
  type NormalizedMembershipPlan,
  type NormalizedMembershipPrice,
} from "../membership";
import type {
  BillingInterval,
  MembershipCatalogConfig,
  PlanStatus,
  PriceType,
  ProviderPriceEnvironment,
  WebPaymentProviderKey,
  WebPlanConfig,
} from "../types";
import { SUPPORTED_WEB_PAYMENT_PROVIDERS } from "../types";

/**
 * Supported pricing models for plans and prices.
 */
export const PRICE_TYPES = ["subscription", "lifetime"] as const satisfies readonly PriceType[];

/**
 * Supported billing intervals for subscription prices.
 */
export const BILLING_INTERVALS = ["month", "year"] as const satisfies readonly BillingInterval[];

/**
 * Top-level payments configuration.
 */
export type PaymentsConfig = {
  plans?: WebPlanConfig[];
};

/**
 * Normalized price after validation.
 */
export type NormalizedPrice = {
  id: string;
  planId: string;
  provider: WebPaymentProviderKey;
  providerPriceId: string;
  currency: string;
  amountCents: number;
  priceType: PriceType;
  interval: BillingInterval | null;
  trialDays: number | null;
  status: PlanStatus;
};

/**
 * Normalized plan after validation.
 */
export type NormalizedPlan = {
  id: string;
  status: PlanStatus;
  prices: NormalizedPrice[];
};

/**
 * Resolves the default web payment price environment from the runtime.
 */
function resolveProviderPriceEnvironment(): ProviderPriceEnvironment {
  const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
    ?.NODE_ENV;
  return nodeEnv === "production" ? "prod" : "test";
}

function buildMembershipCatalogIndex(input: MembershipCatalogConfig) {
  const planById = new Map<string, NormalizedMembershipPlan>();
  const priceByKey = new Map<string, NormalizedMembershipPrice>();

  for (const plan of normalizeMembershipCatalogConfig(input)) {
    planById.set(plan.id, plan);
    for (const price of plan.prices) {
      priceByKey.set(`${plan.id}:${price.id}`, price);
    }
  }

  return { planById, priceByKey };
}

function getMembershipPrice(
  priceByKey: Map<string, NormalizedMembershipPrice>,
  planId: string,
  priceId: string,
) {
  const price = priceByKey.get(`${planId}:${priceId}`);
  if (!price) {
    throw new Error(`[payments] Unknown membership price "${planId}:${priceId}".`);
  }
  return price;
}

function getMembershipPlan(planById: Map<string, NormalizedMembershipPlan>, planId: string) {
  const plan = planById.get(planId);
  if (!plan) {
    throw new Error(`[payments] Unknown membership plan "${planId}".`);
  }
  return plan;
}

function isFreePaymentsPlan(plan: WebPlanConfig) {
  return plan.id === "free";
}

function resolveAdapterStatus(
  membershipStatus: PlanStatus,
  adapterStatus: PlanStatus | undefined,
): PlanStatus {
  return membershipStatus === "archived" ? "archived" : (adapterStatus ?? membershipStatus);
}

function assertWebPriceSemantics(
  price: NonNullable<WebPlanConfig["prices"]>[number],
  membershipPrice: NormalizedMembershipPrice,
) {
  if (price.priceType !== membershipPrice.priceType) {
    throw new Error(
      `[payments] priceType mismatch for "${membershipPrice.planId}:${membershipPrice.id}". Expected "${membershipPrice.priceType}" from Membership Catalog, received "${price.priceType}".`,
    );
  }

  const interval = price.priceType === "subscription" ? (price.interval ?? null) : null;
  if (interval !== membershipPrice.interval) {
    throw new Error(
      `[payments] interval mismatch for "${membershipPrice.planId}:${membershipPrice.id}". Expected "${membershipPrice.interval}" from Membership Catalog, received "${interval}".`,
    );
  }
}

function collectTrialDaysByPriceId(
  plans: WebPlanConfig[] | undefined,
  priceByKey: Map<string, NormalizedMembershipPrice>,
) {
  const trialDaysByPriceId = new Map<string, number>();
  const normalizedPlans = Array.isArray(plans) ? plans : [];

  for (const plan of normalizedPlans) {
    const prices = Array.isArray(plan.prices) ? plan.prices : [];
    for (const price of prices) {
      if (price.trialDays == null) {
        continue;
      }
      if (!Number.isInteger(price.trialDays) || price.trialDays <= 0) {
        throw new Error(`[payments] trialDays must be a positive integer for price ${price.id}.`);
      }
      const membershipPrice = getMembershipPrice(priceByKey, plan.id, price.id);
      if (membershipPrice.priceType !== "subscription") {
        throw new Error(
          `[payments] trialDays is only allowed for subscription prices: ${price.id}.`,
        );
      }
      trialDaysByPriceId.set(price.id, price.trialDays);
    }
  }

  return trialDaysByPriceId;
}

/**
 * Converts web-only environment price blocks into the shared single-providerPriceId shape.
 */
function selectProviderPriceEnvironment(
  plans: WebPlanConfig[] | undefined,
  providerPriceEnvironment: ProviderPriceEnvironment,
  membershipPlans: Map<string, NormalizedMembershipPlan>,
  membershipPrices: Map<string, NormalizedMembershipPrice>,
): PricingConfigPlan<WebPaymentProviderKey, PriceType, BillingInterval>[] | undefined {
  return plans?.map((plan) => {
    if (isFreePaymentsPlan(plan)) {
      if (plan.prices?.length) {
        throw new Error("[payments] Free plan must not define provider prices.");
      }

      return {
        id: plan.id,
        status: plan.status,
        prices: [],
      };
    }

    const membershipPlan = getMembershipPlan(membershipPlans, plan.id);
    const planStatus = resolveAdapterStatus(membershipPlan.status, plan.status);

    return {
      id: plan.id,
      status: planStatus,
      prices: plan.prices?.map((price) => {
        const membershipPrice = getMembershipPrice(membershipPrices, plan.id, price.id);
        assertWebPriceSemantics(price, membershipPrice);

        const providerPriceId = price[providerPriceEnvironment]?.providerPriceId;
        if (!providerPriceId) {
          throw new Error(
            `[payments] ${providerPriceEnvironment}.providerPriceId is required for price ${price.id}.`,
          );
        }

        return {
          id: price.id,
          provider: price.provider,
          providerPriceId,
          currency: price.currency,
          amountCents: price.amountCents,
          priceType: membershipPrice.priceType,
          interval: membershipPrice.interval,
          status: resolveAdapterStatus(membershipPrice.status, price.status),
        };
      }),
    };
  });
}

/**
 * Validate and normalize the payments configuration.
 */
export function normalizePaymentsConfig(
  input: PaymentsConfig,
  providerPriceEnvironment: ProviderPriceEnvironment = resolveProviderPriceEnvironment(),
  membershipCatalog: MembershipCatalogConfig = membershipCatalogConfig,
): NormalizedPlan[] {
  const membershipIndex = buildMembershipCatalogIndex(membershipCatalog);
  const trialDaysByPriceId = collectTrialDaysByPriceId(input.plans, membershipIndex.priceByKey);
  const normalizedPlans = normalizePlanPricingConfig({
    plans: selectProviderPriceEnvironment(
      input.plans,
      providerPriceEnvironment,
      membershipIndex.planById,
      membershipIndex.priceByKey,
    ),
    supportedProviders: SUPPORTED_WEB_PAYMENT_PROVIDERS,
    supportedPriceTypes: PRICE_TYPES,
    supportedIntervals: BILLING_INTERVALS,
    subscriptionPriceType: "subscription",
    lifetimePriceType: "lifetime",
    errorPrefix: "[payments]",
  });

  return normalizedPlans.map((plan) => ({
    ...plan,
    prices: plan.prices.map((price) => ({
      ...price,
      trialDays: trialDaysByPriceId.get(price.id) ?? null,
    })),
  }));
}

const DEFAULT_WEB_PAYMENTS_CONFIG: {
  provider: WebPaymentProviderKey;
  plans: WebPlanConfig[];
} = {
  provider: "stripe",
  plans: [],
};

function resolveWebPaymentsConfig(): {
  provider: WebPaymentProviderKey;
  plans: WebPlanConfig[];
} {
  const webPaymentsConfig = resolveWebCommonConfig().payments;

  if (!webPaymentsConfig) {
    return DEFAULT_WEB_PAYMENTS_CONFIG;
  }

  return {
    provider: webPaymentsConfig.provider,
    plans: webPaymentsConfig.plans,
  };
}

const resolvedConfig = resolveWebPaymentsConfig();

/**
 * Typed plans config loaded from app config.
 */
export const paymentsConfig: PaymentsConfig = {
  plans: resolvedConfig.plans,
};

/**
 * Default web payment provider used when one is not specified.
 */
export const DEFAULT_WEB_PAYMENT_PROVIDER: WebPaymentProviderKey = resolvedConfig.provider;

/**
 * All possible subscription statuses from payment providers.
 */
export const SUBSCRIPTION_STATUSES = [
  "active", // Subscription is current and paid
  "trialing", // User is in free trial period
  "past_due", // Payment failed but subscription still active
  "paused", // Subscription is paused and access should be suspended
  "canceled", // Subscription has been canceled
  "incomplete", // Initial payment failed or incomplete
  "unpaid", // Payment failed but subscription not yet canceled
] as const;

/**
 * Subscription status type derived from SUBSCRIPTION_STATUSES.
 */
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Subscription statuses that are considered "active" for billing purposes.
 * These statuses allow users to access paid features.
 */
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  "active", // Subscription is current and paid
  "trialing", // User is in free trial period
]);

/**
 * Billing priority levels for resolving conflicts when users have multiple payment methods.
 * Higher priority takes precedence when determining active billing status.
 */
export const BILLING_PRIORITY = {
  ACTIVE_SUBSCRIPTION: "active_subscription", // Highest priority: active subscription
  LIFETIME_PURCHASE: "lifetime_purchase", // Medium priority: one-time purchase
  NONE: "none", // Lowest priority: no active billing
} as const;

/**
 * Billing priority type derived from BILLING_PRIORITY.
 */
export type BillingPriority = (typeof BILLING_PRIORITY)[keyof typeof BILLING_PRIORITY];
