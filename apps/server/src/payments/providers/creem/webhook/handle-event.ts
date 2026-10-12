import { and, eq, isNull, lt, or } from "drizzle-orm";
import {
  completeCreditOrderPurchase,
  grantCreditPackagePurchase,
  markCreditOrderRefunded,
  revokeCreditPurchaseBySource,
} from "@/credits";
import type { Database } from "@/db";
import {
  billingCheckoutSession,
  billingCustomer,
  billingPurchase,
  billingSubscription,
} from "@/db/schema/payments";
import { findPriceById, findPriceByProviderPriceId } from "@/payments/domain/plan-catalog";
import {
  findPurchaseByProviderIntent,
  findSubscriptionByProviderId,
  upsertBillingCustomer,
} from "@/payments/infrastructure/repositories/billing-store";
import type { BillingUser } from "@/payments/public/types";
import { reconcileActivatedPriceWithExistingSubscriptions } from "../../shared/activated-price-effects";
import { mapCreemSubscriptionState } from "../shared";
import type { CreemSubscriptionState } from "../shared";
import type {
  CreemCheckoutCompletedObject,
  CreemMetadata,
  CreemRefundObject,
  CreemSubscription,
  CreemWebhookEnvelope,
} from "../types";
import { getCreemCustomerEmail, getCreemCustomerId, getCreemProductId } from "../types";

type CreemSubscriptionEventType = Extract<
  CreemWebhookEnvelope["eventType"],
  `subscription.${string}`
>;
type CreemSubscriptionWebhookEvent = CreemWebhookEnvelope & {
  eventType: CreemSubscriptionEventType;
};

/**
 * Converts an optional ISO timestamp string into a Date.
 */
function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

/**
 * Resolves the billing user for a Creem event from metadata, stored checkout state, or customer mapping.
 */
async function resolveCreemUser(
  db: Database,
  input: {
    metadata?: CreemMetadata | null;
    providerCustomerId?: string | null;
    storedUserId?: string | null;
  },
): Promise<BillingUser | null> {
  // Metadata and stored checkout state are the most reliable ownership hints during checkout webhooks.
  const userId = input.metadata?.userId ?? input.storedUserId;
  if (userId) {
    return { userId };
  }

  if (!input.providerCustomerId) {
    return null;
  }

  const [customer] = await db
    .select()
    .from(billingCustomer)
    .where(
      and(
        eq(billingCustomer.provider, "creem"),
        eq(billingCustomer.providerCustomerId, input.providerCustomerId),
      ),
    )
    .limit(1);

  if (!customer) {
    return null;
  }

  return { userId: customer.userId };
}

/**
 * Resolves checkout metadata from the most specific available Creem checkout payload node.
 */
function resolveCheckoutMetadata(object: CreemCheckoutCompletedObject) {
  return object.metadata ?? object.subscription?.metadata ?? object.order?.metadata ?? null;
}

/**
 * Resolves the customer attached to a Creem checkout completion payload.
 */
function resolveCheckoutCustomer(object: CreemCheckoutCompletedObject) {
  return object.customer ?? object.subscription?.customer ?? object.order?.customer ?? null;
}

/**
 * Resolves the Creem product ID from any supported checkout completion payload shape.
 */
function resolveCheckoutProductId(object: CreemCheckoutCompletedObject) {
  return (
    getCreemProductId(object.product) ??
    getCreemProductId(object.subscription?.product) ??
    getCreemProductId(object.order?.product) ??
    null
  );
}

/**
 * Resolves refund metadata from the richest payload node available.
 */
function resolveRefundMetadata(object: CreemRefundObject) {
  return (
    object.subscription?.metadata ?? object.checkout?.metadata ?? object.order?.metadata ?? null
  );
}

/**
 * Resolves the most useful customer identifier included in a refund payload.
 */
function resolveRefundCustomerId(object: CreemRefundObject) {
  return (
    getCreemCustomerId(object.customer) ??
    getCreemCustomerId(object.subscription?.customer) ??
    getCreemCustomerId(object.checkout?.customer) ??
    getCreemCustomerId(object.order?.customer) ??
    null
  );
}

function resolveCreemSubscriptionStateFromEvent(
  eventType: CreemSubscriptionEventType,
  subscription: CreemSubscription,
): CreemSubscriptionState {
  switch (eventType) {
    case "subscription.active":
      return "active";
    case "subscription.trialing":
      return "trialing";
    case "subscription.scheduled_cancel":
      return "scheduled_cancel";
    case "subscription.past_due":
      return "past_due";
    case "subscription.paused":
      return "paused";
    case "subscription.canceled":
      return "canceled";
    case "subscription.expired":
      return "expired";
    case "subscription.paid":
    case "subscription.update":
      return subscription.status;
  }
}

/**
 * Inserts or updates the local subscription row from a Creem subscription payload.
 */
async function upsertCreemSubscription(
  db: Database,
  input: {
    user: BillingUser;
    providerEventAt: Date;
    subscription: CreemSubscription;
    planId: string;
    priceId: string;
  },
) {
  const now = new Date();
  const mappedState = mapCreemSubscriptionState(input.subscription.status);
  const providerCustomerId = getCreemCustomerId(input.subscription.customer);

  if (!providerCustomerId) {
    throw new Error("Creem subscription missing customer id");
  }

  const existing = await findSubscriptionByProviderId(db, "creem", input.subscription.id);
  if (
    existing?.providerEventAt &&
    input.providerEventAt.getTime() < existing.providerEventAt.getTime()
  ) {
    return;
  }

  // Upsert keeps subscription state idempotent across repeated deliveries.
  await db
    .insert(billingSubscription)
    .values({
      id: crypto.randomUUID(),
      userId: input.user.userId,
      provider: "creem",
      providerSubscriptionId: input.subscription.id,
      providerCustomerId,
      planId: input.planId,
      priceId: input.priceId,
      status: mappedState.status,
      currentPeriodEnd: toDate(input.subscription.current_period_end_date),
      cancelAtPeriodEnd: mappedState.cancelAtPeriodEnd,
      startedAt: toDate(input.subscription.current_period_start_date),
      endedAt: mappedState.status === "canceled" ? toDate(input.subscription.canceled_at) : null,
      providerEventAt: input.providerEventAt,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [billingSubscription.provider, billingSubscription.providerSubscriptionId],
      set: {
        userId: input.user.userId,
        providerCustomerId,
        planId: input.planId,
        priceId: input.priceId,
        status: mappedState.status,
        currentPeriodEnd: toDate(input.subscription.current_period_end_date),
        cancelAtPeriodEnd: mappedState.cancelAtPeriodEnd,
        startedAt: toDate(input.subscription.current_period_start_date),
        endedAt: mappedState.status === "canceled" ? toDate(input.subscription.canceled_at) : null,
        providerEventAt: input.providerEventAt,
        updatedAt: now,
      },
    });

  if (mappedState.status === "active" || mappedState.status === "trialing") {
    // A newly activated higher-tier Creem entitlement may require older Stripe subscriptions to stop renewing.
    await reconcileActivatedPriceWithExistingSubscriptions(db, input.user, input.priceId, "creem");
  }
}

/**
 * Inserts or updates the local one-time purchase row from a Creem transaction.
 */
async function upsertCreemPurchase(
  db: Database,
  input: {
    user: BillingUser;
    providerEventAt: Date;
    providerTransactionId: string;
    planId: string;
    priceId: string;
    status: "succeeded" | "refunded";
  },
) {
  const now = new Date();
  const existing = await findPurchaseByProviderIntent(db, "creem", input.providerTransactionId);

  if (
    existing?.providerEventAt &&
    input.providerEventAt.getTime() < existing.providerEventAt.getTime()
  ) {
    return;
  }

  await db
    .insert(billingPurchase)
    .values({
      id: crypto.randomUUID(),
      userId: input.user.userId,
      provider: "creem",
      providerPaymentIntentId: input.providerTransactionId,
      planId: input.planId,
      priceId: input.priceId,
      status: input.status,
      paidAt: input.status === "succeeded" ? input.providerEventAt : null,
      providerEventAt: input.providerEventAt,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [billingPurchase.provider, billingPurchase.providerPaymentIntentId],
      set: {
        userId: input.user.userId,
        planId: input.planId,
        priceId: input.priceId,
        status: input.status,
        paidAt: input.status === "succeeded" ? input.providerEventAt : null,
        providerEventAt: input.providerEventAt,
        updatedAt: now,
      },
    });

  if (input.status === "succeeded") {
    await reconcileActivatedPriceWithExistingSubscriptions(db, input.user, input.priceId, "creem");
  }
}

/**
 * Handles a Creem checkout completion by resolving ownership and persisting subscription or purchase state.
 */
async function handleCreemCheckoutCompleted(
  db: Database,
  event: CreemWebhookEnvelope,
  object: CreemCheckoutCompletedObject,
) {
  const metadata = resolveCheckoutMetadata(object);
  const customer = resolveCheckoutCustomer(object);

  // Checkout rows created before redirect provide a stable fallback when webhook payloads are sparse.
  const [storedCheckout] = await db
    .select({
      userId: billingCheckoutSession.userId,
      planId: billingCheckoutSession.planId,
      priceId: billingCheckoutSession.priceId,
    })
    .from(billingCheckoutSession)
    .where(
      and(
        eq(billingCheckoutSession.provider, "creem"),
        eq(billingCheckoutSession.providerSessionId, object.id),
      ),
    )
    .limit(1);

  const user = await resolveCreemUser(db, {
    metadata,
    providerCustomerId: getCreemCustomerId(customer),
    storedUserId: storedCheckout?.userId,
  });

  if (!user) {
    throw new Error(`Creem checkout completed missing billing user for session ${object.id}`);
  }

  const providerCustomerId = getCreemCustomerId(customer);
  const normalizedSubscription =
    object.subscription && providerCustomerId && !getCreemCustomerId(object.subscription.customer)
      ? {
          ...object.subscription,
          customer: providerCustomerId,
        }
      : object.subscription;

  if (providerCustomerId) {
    await upsertBillingCustomer(db, {
      user,
      provider: "creem",
      providerCustomerId,
      email: getCreemCustomerEmail(customer),
    });
  }

  await db
    .update(billingCheckoutSession)
    .set({
      status: "completed",
      updatedAt: new Date(event.created_at),
    })
    .where(
      and(
        eq(billingCheckoutSession.provider, "creem"),
        eq(billingCheckoutSession.providerSessionId, object.id),
      ),
    );

  if (metadata?.kind === "credit_purchase") {
    // Credit package checkouts bypass billing entitlement writes and only grant ledger credits.
    const creditPackageId = metadata.creditPackageId;
    const creditOrderId = metadata.creditOrderId;
    const sourceId = object.order?.transaction ?? object.order?.id ?? object.id;
    if (!creditPackageId) {
      throw new Error(`Creem credit checkout missing package id for session ${object.id}`);
    }

    if (creditOrderId) {
      await completeCreditOrderPurchase(db, {
        orderId: creditOrderId,
        sourceProvider: "creem",
        sourceId,
        providerSessionId: object.id,
        providerPaymentId: sourceId,
        metadata: {
          checkoutSessionId: object.id,
          orderId: object.order?.id ?? null,
          transactionId: object.order?.transaction ?? null,
        },
      });
      return;
    }

    await grantCreditPackagePurchase(db, {
      user,
      packageId: creditPackageId,
      sourceProvider: "creem",
      sourceId,
      metadata: {
        checkoutSessionId: object.id,
        orderId: object.order?.id ?? null,
        transactionId: object.order?.transaction ?? null,
      },
    });
    return;
  }

  // Prefer catalog mapping, then metadata, then the stored checkout row to recover plan ownership.
  const productId = resolveCheckoutProductId(object);
  const mappedPrice = productId ? findPriceByProviderPriceId("creem", productId) : undefined;
  const planId = mappedPrice?.planId ?? metadata?.planId ?? storedCheckout?.planId;
  const priceId = mappedPrice?.id ?? metadata?.priceId ?? storedCheckout?.priceId;

  if (!planId || !priceId) {
    throw new Error(
      `Creem checkout completed missing plan or price mapping for session ${object.id}`,
    );
  }

  const price = findPriceById(priceId);
  if (!price) {
    return;
  }

  const providerEventAt = new Date(event.created_at);

  // Creem checkout completion can represent either a subscription purchase or a one-time order.
  if (price.priceType === "subscription" && normalizedSubscription) {
    await upsertCreemSubscription(db, {
      user,
      providerEventAt,
      subscription: normalizedSubscription,
      planId,
      priceId,
    });
    return;
  }

  if (price.priceType === "lifetime" && object.order?.transaction) {
    await upsertCreemPurchase(db, {
      user,
      providerEventAt,
      providerTransactionId: object.order.transaction,
      planId,
      priceId,
      status: "succeeded",
    });
  }
}

/**
 * Handles Creem subscription lifecycle webhooks and syncs the local subscription record.
 */
async function handleCreemSubscriptionEvent(
  db: Database,
  event: CreemSubscriptionWebhookEvent,
  object: CreemSubscription,
) {
  const normalizedSubscription = {
    ...object,
    status: resolveCreemSubscriptionStateFromEvent(event.eventType, object),
  } satisfies CreemSubscription;
  const providerCustomerId = getCreemCustomerId(object.customer);
  const user = await resolveCreemUser(db, {
    metadata: normalizedSubscription.metadata,
    providerCustomerId,
  });

  if (!providerCustomerId) {
    throw new Error(`Creem subscription event missing customer id for subscription ${object.id}`);
  }

  if (!user) {
    console.error("Creem subscription event missing billing user", {
      providerEventId: event.id,
      providerSubscriptionId: normalizedSubscription.id,
      providerCustomerId,
      metadata: normalizedSubscription.metadata,
    });
    return;
  }

  const providerProductId = getCreemProductId(normalizedSubscription.product);
  const mappedPrice = providerProductId
    ? findPriceByProviderPriceId("creem", providerProductId)
    : undefined;

  // Subscription webhooks may arrive without prior checkout context, so metadata must be enough to recover mapping.
  const planId = mappedPrice?.planId ?? normalizedSubscription.metadata?.planId;
  const priceId = mappedPrice?.id ?? normalizedSubscription.metadata?.priceId;

  if (!planId || !priceId) {
    throw new Error(
      `Creem subscription event missing plan or price mapping for subscription ${normalizedSubscription.id}`,
    );
  }

  await upsertBillingCustomer(db, {
    user,
    provider: "creem",
    providerCustomerId,
    email: getCreemCustomerEmail(normalizedSubscription.customer),
  });

  await upsertCreemSubscription(db, {
    user,
    providerEventAt: new Date(event.created_at),
    subscription: normalizedSubscription,
    planId,
    priceId,
  });
}

/**
 * Resolves refund ownership from payload metadata first, then local subscription/purchase rows,
 * and finally the customer mapping table.
 */
async function resolveCreemRefundUser(db: Database, object: CreemRefundObject) {
  const metadata = resolveRefundMetadata(object);
  if (metadata?.userId) {
    return { userId: metadata.userId } satisfies BillingUser;
  }

  if (object.subscription?.id) {
    const subscription = await findSubscriptionByProviderId(db, "creem", object.subscription.id);
    if (subscription) {
      return { userId: subscription.userId } satisfies BillingUser;
    }
  }

  const purchase = await findPurchaseByProviderIntent(db, "creem", object.transaction.id);
  if (purchase) {
    return { userId: purchase.userId } satisfies BillingUser;
  }

  return resolveCreemUser(db, {
    metadata,
    providerCustomerId: resolveRefundCustomerId(object),
  });
}

/**
 * Handles Creem refund webhooks and updates related purchase and subscription state.
 */
async function handleCreemRefundCreated(
  db: Database,
  event: CreemWebhookEnvelope,
  object: CreemRefundObject,
) {
  const providerEventAt = new Date(event.created_at);
  const user = await resolveCreemRefundUser(db, object);

  if (!user) {
    throw new Error(
      `Creem refund event missing billing user for refund ${object.id} (event ${event.id}, customer ${resolveRefundCustomerId(object) ?? "unknown"}, transaction ${object.transaction.id}, subscription ${object.subscription?.id ?? "none"})`,
    );
  }

  const revokedCreditPurchase = await revokeCreditPurchaseBySource(db, {
    originalSourceProvider: "creem",
    originalSourceId: object.transaction.id,
    refundSourceId: object.id,
    metadata: {
      providerEventId: event.id,
      refundId: object.id,
      transactionId: object.transaction.id,
    },
  });
  const markedCreditOrder = await markCreditOrderRefunded(db, {
    sourceProvider: "creem",
    providerPaymentId: object.transaction.id,
  });
  if (revokedCreditPurchase || markedCreditOrder) {
    return;
  }

  const [purchase] = await db
    .select({
      planId: billingPurchase.planId,
      priceId: billingPurchase.priceId,
    })
    .from(billingPurchase)
    .where(
      and(
        eq(billingPurchase.provider, "creem"),
        eq(billingPurchase.providerPaymentIntentId, object.transaction.id),
      ),
    )
    .limit(1);

  if (purchase) {
    await upsertCreemPurchase(db, {
      user,
      providerEventAt,
      providerTransactionId: object.transaction.id,
      planId: purchase.planId,
      priceId: purchase.priceId,
      status: "refunded",
    });
  }

  if (object.subscription?.id) {
    // Refunds can terminate the linked recurring entitlement even when the purchase row already existed.
    await db
      .update(billingSubscription)
      .set({
        status: "canceled",
        cancelAtPeriodEnd: false,
        endedAt: providerEventAt,
        providerEventAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(billingSubscription.provider, "creem"),
          eq(billingSubscription.providerSubscriptionId, object.subscription.id),
          or(
            isNull(billingSubscription.providerEventAt),
            lt(billingSubscription.providerEventAt, providerEventAt),
          ),
        ),
      );
  }
}

/**
 * Logs Creem disputes so chargebacks stay visible until a dedicated state transition exists.
 */
function handleCreemDisputeCreated(event: CreemWebhookEnvelope) {
  console.error("Creem dispute created", {
    providerEventId: event.id,
    providerDisputeId: "id" in event.object ? event.object.id : null,
    providerCustomerId:
      "customer" in event.object ? getCreemCustomerId(event.object.customer) : null,
  });
}

/**
 * Dispatches a verified Creem webhook payload to the matching event handler.
 */
export async function handleCreemEvent(db: Database, payload: unknown) {
  const event = payload as CreemWebhookEnvelope;

  switch (event.eventType) {
    case "checkout.completed":
      await handleCreemCheckoutCompleted(db, event, event.object as CreemCheckoutCompletedObject);
      return;
    // These event types all carry a CreemSubscription-shaped payload and share the same sync path.
    case "subscription.active":
    case "subscription.trialing":
    case "subscription.paid":
    case "subscription.scheduled_cancel":
    case "subscription.past_due":
    case "subscription.update":
    case "subscription.expired":
    case "subscription.canceled":
    case "subscription.paused":
      await handleCreemSubscriptionEvent(
        db,
        event as CreemSubscriptionWebhookEvent,
        event.object as CreemSubscription,
      );
      return;
    case "refund.created":
      await handleCreemRefundCreated(db, event, event.object as CreemRefundObject);
      return;
    case "dispute.created":
      handleCreemDisputeCreated(event);
      return;
  }
}
