import { ACTIVE_SUBSCRIPTION_STATUSES } from "@repo/app-config/payments/web";
import { toNullable } from "@repo/shared";
import type { BillingStatus } from "@/payments/public/schemas";
import type { BillingUser } from "@/payments/public/types";
import type { billingPurchase, billingSubscription } from "@/db/schema/payments";
import type { adminMembershipGrant } from "@/db/schema/admin-operations";
import {
  findBillingPlanById,
  findBillingPriceById,
  findBillingPriceForRecord,
} from "../domain/plan-catalog";
import { resolveCurrentEntitlement } from "../domain/policy";

type BillingStatusSubscriptionRecord = typeof billingSubscription.$inferSelect;

type BillingStatusPurchaseRecord = typeof billingPurchase.$inferSelect;
type AdminTrialRecord = typeof adminMembershipGrant.$inferSelect;

type BillingDomainStatus = BillingStatus["billingDomains"]["web"];

function findActiveSubscriptionForCurrentEntitlement(
  subscriptions: BillingStatusSubscriptionRecord[],
  currentEntitlement: BillingDomainStatus["currentEntitlement"],
  activePlan: BillingDomainStatus["activePlan"],
  activePrice: BillingDomainStatus["activePrice"],
) {
  if (currentEntitlement.source !== "subscription" || !activePlan?.id || !activePrice?.id) {
    return null;
  }

  return (
    subscriptions.find(
      (item) =>
        ACTIVE_SUBSCRIPTION_STATUSES.has(item.status) &&
        item.planId === activePlan.id &&
        item.priceId === activePrice.id,
    ) ?? null
  );
}

function findActivePurchaseForCurrentEntitlement(
  purchases: BillingStatusPurchaseRecord[],
  currentEntitlement: BillingDomainStatus["currentEntitlement"],
  activePlan: BillingDomainStatus["activePlan"],
  activePrice: BillingDomainStatus["activePrice"],
) {
  if (currentEntitlement.source !== "lifetime" || !activePlan?.id || !activePrice?.id) {
    return null;
  }

  return (
    purchases.find(
      (item) =>
        item.status === "succeeded" &&
        item.planId === activePlan.id &&
        item.priceId === activePrice.id,
    ) ?? null
  );
}

function resolveBillingDomainStatus(input: {
  subscriptions: BillingStatusSubscriptionRecord[];
  purchases: BillingStatusPurchaseRecord[];
  canManageBilling: boolean;
}): BillingDomainStatus {
  const hasActiveSubscription = input.subscriptions.some((item) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(item.status),
  );

  const currentEntitlement = resolveCurrentEntitlement({
    subscriptions: input.subscriptions,
    purchases: input.purchases,
    findPriceById: findBillingPriceById,
  });
  const { planId, priceId } = currentEntitlement;

  let activePlan: BillingDomainStatus["activePlan"] = null;
  let activePrice: BillingDomainStatus["activePrice"] = null;

  if (planId && priceId) {
    const plan = findBillingPlanById(planId);
    const price = findBillingPriceById(priceId);

    if (plan) {
      activePlan = { id: plan.id };
    }

    if (price) {
      activePrice = {
        id: price.id,
        currency: price.currency,
        amountCents: price.amountCents,
        priceType: price.priceType,
        interval: price.interval ?? null,
      };
    }
  }

  let activeSubscription = findActiveSubscriptionForCurrentEntitlement(
    input.subscriptions,
    {
      tier: currentEntitlement.tier,
      source: currentEntitlement.source,
    },
    activePlan,
    activePrice,
  );
  let activePurchase = findActivePurchaseForCurrentEntitlement(
    input.purchases,
    {
      tier: currentEntitlement.tier,
      source: currentEntitlement.source,
    },
    activePlan,
    activePrice,
  );

  const providerSpecificPrice =
    activeSubscription !== null
      ? findBillingPriceForRecord(activeSubscription)
      : activePurchase !== null
        ? findBillingPriceForRecord(activePurchase)
        : null;

  if (providerSpecificPrice) {
    activePrice = {
      id: providerSpecificPrice.id,
      currency: providerSpecificPrice.currency,
      amountCents: providerSpecificPrice.amountCents,
      priceType: providerSpecificPrice.priceType,
      interval: providerSpecificPrice.interval ?? null,
    };

    activeSubscription = findActiveSubscriptionForCurrentEntitlement(
      input.subscriptions,
      {
        tier: currentEntitlement.tier,
        source: currentEntitlement.source,
      },
      activePlan,
      activePrice,
    );
    activePurchase = findActivePurchaseForCurrentEntitlement(
      input.purchases,
      {
        tier: currentEntitlement.tier,
        source: currentEntitlement.source,
      },
      activePlan,
      activePrice,
    );
  }

  const provider =
    currentEntitlement.source === "subscription"
      ? (activeSubscription?.provider ?? null)
      : currentEntitlement.source === "lifetime"
        ? (activePurchase?.provider ?? null)
        : null;

  return {
    provider,
    canManageBilling:
      input.canManageBilling &&
      (currentEntitlement.source === "subscription" || currentEntitlement.source === "lifetime") &&
      provider !== null,
    activePlan,
    activePrice,
    currentEntitlement: {
      tier: currentEntitlement.tier,
      source: currentEntitlement.source,
    },
    hasActiveSubscription,
    subscription: toNullable(activeSubscription),
    lifetimePurchase: toNullable(activePurchase),
  };
}

export function resolveBillingStatus(input: {
  user: BillingUser;
  subscriptions: BillingStatusSubscriptionRecord[];
  purchases: BillingStatusPurchaseRecord[];
  adminTrial?: AdminTrialRecord | null;
}): BillingStatus {
  const allRecords = { subscriptions: input.subscriptions, purchases: input.purchases };

  let globalBilling = resolveBillingDomainStatus({
    ...allRecords,
    canManageBilling: false,
  });
  const webBilling = resolveBillingDomainStatus({
    ...allRecords,
    canManageBilling: true,
  });
  if (globalBilling.currentEntitlement.source === "none" && input.adminTrial) {
    globalBilling = {
      ...globalBilling,
      currentEntitlement: { tier: input.adminTrial.tier, source: "admin_trial" },
    };
  }
  const globalCanManageBilling =
    (globalBilling.currentEntitlement.source === "subscription" ||
      globalBilling.currentEntitlement.source === "lifetime") &&
    globalBilling.provider !== null;

  return {
    userId: input.user.userId,
    billingProvider: globalBilling.provider,
    canManageBilling: globalCanManageBilling,
    activePlan: globalBilling.activePlan,
    activePrice: globalBilling.activePrice,
    currentEntitlement: globalBilling.currentEntitlement,
    hasActiveSubscription: globalBilling.hasActiveSubscription,
    subscription: globalBilling.subscription,
    lifetimePurchase: globalBilling.lifetimePurchase,
    adminTrial: input.adminTrial
      ? {
          tier: input.adminTrial.tier,
          startsAt: input.adminTrial.startsAt,
          expiresAt: input.adminTrial.expiresAt,
        }
      : null,
    billingDomains: {
      web: webBilling,
    },
  };
}
