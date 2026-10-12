import { SUPPORTED_WEB_PAYMENT_PROVIDERS, type ServerPaymentProviderKey } from "@repo/app-config";
import { resolveMembershipTier } from "@repo/app-config/membership";
import { and, eq, inArray } from "drizzle-orm";
import { billingSubscription } from "@/db/schema/payments";
import { findPriceById } from "@/payments/domain/plan-catalog";
import type { DbLike } from "@/payments/infrastructure/repositories/billing-store";
import type { BillingUser } from "@/payments/public/types";
import { getPaymentProvider } from "../index";

/**
 * Applies web billing side effects after a higher-tier web price activates.
 */
export async function reconcileActivatedPriceWithExistingSubscriptions(
  db: DbLike,
  user: BillingUser,
  priceId: string,
  _provider?: ServerPaymentProviderKey,
) {
  const activatedPrice = findPriceById(priceId);
  if (!activatedPrice) {
    return;
  }

  const activatedTier = resolveMembershipTier({
    priceType: activatedPrice.priceType,
    interval: activatedPrice.interval,
  });

  if (activatedTier === "monthly" || activatedTier === "free") {
    return;
  }

  await cancelLowerTierSubscriptionsAtPeriodEnd(db, user, activatedTier);
}

/**
 * Marks lower-tier web provider subscriptions to stop renewal after the current billing cycle.
 */
async function cancelLowerTierSubscriptionsAtPeriodEnd(
  db: DbLike,
  user: BillingUser,
  targetTier: "yearly" | "lifetime",
) {
  const now = new Date();
  const cancellableStatuses = new Set(["active", "trialing", "past_due", "unpaid"]);
  const subscriptions = await db
    .select()
    .from(billingSubscription)
    .where(
      and(
        eq(billingSubscription.userId, user.userId),
        inArray(billingSubscription.provider, SUPPORTED_WEB_PAYMENT_PROVIDERS),
      ),
    );

  for (const subscription of subscriptions) {
    if (!cancellableStatuses.has(subscription.status) || subscription.cancelAtPeriodEnd) {
      continue;
    }

    const price = findPriceById(subscription.priceId);
    if (!price) {
      continue;
    }

    const subscriptionTier = resolveMembershipTier({
      priceType: price.priceType,
      interval: price.interval,
    });

    if (
      (targetTier === "yearly" && subscriptionTier !== "monthly") ||
      (targetTier === "lifetime" && subscriptionTier === "lifetime")
    ) {
      continue;
    }

    const provider = getPaymentProvider(subscription.provider);
    await provider.setSubscriptionCancelAtPeriodEnd({
      subscriptionId: subscription.providerSubscriptionId,
      cancelAtPeriodEnd: true,
    });

    await db
      .update(billingSubscription)
      .set({
        cancelAtPeriodEnd: true,
        updatedAt: now,
      })
      .where(eq(billingSubscription.id, subscription.id));
  }
}
