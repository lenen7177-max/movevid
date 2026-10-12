import type Stripe from "stripe";
import type { Database } from "@/db";
import { billingSubscription } from "@/db/schema/payments";
import { findPriceByProviderPriceId } from "../../../domain/plan-catalog";
import type { DbLike } from "../../../infrastructure/repositories/billing-store";
import {
  findSubscriptionByProviderId,
  upsertBillingCustomer,
} from "../../../infrastructure/repositories/billing-store";
import type { BillingUser } from "../../../public/types";
import { resolveUserFromMetadata } from "./owner-resolver";

/**
 * Handles subscription create/update/delete events from Stripe.
 */
export async function handleStripeSubscription(
  db: Database,
  subscription: Stripe.Subscription,
  providerEventAt: Date,
) {
  const metadata = subscription.metadata ?? {};
  const providerCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

  const user = await resolveUserFromMetadata(db, {
    metadata,
    providerCustomerId,
  });

  if (!user || !providerCustomerId) {
    console.error("Stripe subscription missing user or customer id", {
      providerSubscriptionId: subscription.id,
      providerCustomerId,
      metadata,
    });
    return;
  }

  const priceIdFromStripe = subscription.items.data.at(0)?.price.id;
  const mappedPrice = priceIdFromStripe
    ? findPriceByProviderPriceId("stripe", priceIdFromStripe)
    : undefined;

  const planId = mappedPrice?.planId ?? metadata.planId;
  const priceId = mappedPrice?.id ?? metadata.priceId;

  if (!planId || !priceId) {
    console.error("Stripe subscription missing plan or price mapping", {
      providerSubscriptionId: subscription.id,
      priceIdFromStripe,
      metadata,
    });
    return;
  }

  await upsertBillingCustomer(db, {
    user,
    provider: "stripe",
    providerCustomerId,
    email: null,
  });

  await upsertSubscriptionFromStripe(db, {
    user,
    subscription,
    planId,
    priceId,
    providerEventAt,
  });
}

/**
 * Upserts local subscription rows from Stripe subscription payload.
 */
async function upsertSubscriptionFromStripe(
  db: DbLike,
  input: {
    user: BillingUser;
    subscription: Stripe.Subscription;
    planId: string;
    priceId: string;
    providerEventAt: Date;
  },
) {
  const now = new Date();
  const status = mapStripeSubscriptionStatus(input.subscription.status);
  const itemPeriodEnd = input.subscription.items.data.at(0)?.current_period_end;
  const existing = await findSubscriptionByProviderId(db, "stripe", input.subscription.id);

  if (
    existing?.providerEventAt &&
    input.providerEventAt.getTime() < existing.providerEventAt.getTime()
  ) {
    return;
  }

  const payload = {
    userId: input.user.userId,
    provider: "stripe" as const,
    providerSubscriptionId: input.subscription.id,
    providerCustomerId:
      typeof input.subscription.customer === "string"
        ? input.subscription.customer
        : (input.subscription.customer?.id ?? ""),
    planId: input.planId,
    priceId: input.priceId,
    status,
    currentPeriodEnd: typeof itemPeriodEnd === "number" ? new Date(itemPeriodEnd * 1000) : null,
    cancelAtPeriodEnd: input.subscription.cancel_at_period_end ?? false,
    startedAt: input.subscription.start_date
      ? new Date(input.subscription.start_date * 1000)
      : null,
    endedAt: input.subscription.ended_at ? new Date(input.subscription.ended_at * 1000) : null,
    providerEventAt: input.providerEventAt,
  };

  await db
    .insert(billingSubscription)
    .values({
      id: crypto.randomUUID(),
      ...payload,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [billingSubscription.provider, billingSubscription.providerSubscriptionId],
      set: {
        userId: payload.userId,
        providerCustomerId: payload.providerCustomerId,
        planId: payload.planId,
        priceId: payload.priceId,
        status: payload.status,
        currentPeriodEnd: payload.currentPeriodEnd,
        cancelAtPeriodEnd: payload.cancelAtPeriodEnd,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        providerEventAt: payload.providerEventAt,
        updatedAt: now,
      },
    });
}

/**
 * Normalizes Stripe subscription status to local subscription status.
 */
function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
      return status;
    case "incomplete_expired":
      return "canceled";
    default:
      return "incomplete";
  }
}
