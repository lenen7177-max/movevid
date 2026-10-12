import { and, eq } from "drizzle-orm";
import { WebhookEventType, type WebhookEvent, type WebhookEventData } from "@waffo/pancake-ts";
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
import { findPriceById } from "@/payments/domain/plan-catalog";
import {
  findPurchaseByProviderIntent,
  findSubscriptionByProviderId,
  upsertBillingCustomer,
} from "@/payments/infrastructure/repositories/billing-store";
import type { BillingUser } from "@/payments/public/types";
import { reconcileActivatedPriceWithExistingSubscriptions } from "../../shared/activated-price-effects";

type WaffoEvent = WebhookEvent<WebhookEventData>;
type WaffoMetadata = Record<string, string>;

type StoredCheckout = {
  userId: string;
  planId: string;
  priceId: string;
} | null;

type WaffoSubscriptionStatus = "active" | "past_due" | "canceled";

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function resolveProviderEventAt(event: WaffoEvent) {
  return new Date(event.timestamp);
}

function resolveMetadata(data: WebhookEventData): WaffoMetadata {
  return Object.assign({}, data.productMetadata, data.orderMetadata);
}

function resolveProviderCustomerId(data: WebhookEventData, user: BillingUser | null) {
  return data.merchantProvidedBuyerIdentity ?? user?.userId ?? data.buyerEmail;
}

async function findStoredCheckout(db: Database, metadata: WaffoMetadata): Promise<StoredCheckout> {
  if (!metadata.checkoutSessionId) {
    return null;
  }

  const [storedCheckout] = await db
    .select({
      userId: billingCheckoutSession.userId,
      planId: billingCheckoutSession.planId,
      priceId: billingCheckoutSession.priceId,
    })
    .from(billingCheckoutSession)
    .where(
      and(
        eq(billingCheckoutSession.provider, "waffo"),
        eq(billingCheckoutSession.id, metadata.checkoutSessionId),
      ),
    )
    .limit(1);

  return storedCheckout ?? null;
}

async function findUserByProviderCustomerId(
  db: Database,
  providerCustomerId: string | null,
): Promise<BillingUser | null> {
  if (!providerCustomerId) {
    return null;
  }

  const [customer] = await db
    .select({ userId: billingCustomer.userId })
    .from(billingCustomer)
    .where(
      and(
        eq(billingCustomer.provider, "waffo"),
        eq(billingCustomer.providerCustomerId, providerCustomerId),
      ),
    )
    .limit(1);

  return customer ? { userId: customer.userId } : null;
}

async function resolveUser(
  db: Database,
  input: {
    data: WebhookEventData;
    metadata: WaffoMetadata;
    storedCheckout: StoredCheckout;
  },
): Promise<BillingUser | null> {
  const userId =
    input.metadata.userId ??
    input.data.merchantProvidedBuyerIdentity ??
    input.storedCheckout?.userId;
  if (userId) {
    return { userId };
  }

  return findUserByProviderCustomerId(db, resolveProviderCustomerId(input.data, null));
}

function resolvePlanPrice(input: {
  metadata: WaffoMetadata;
  storedCheckout: StoredCheckout;
  existing?: {
    planId: string;
    priceId: string;
  } | null;
}) {
  return {
    planId: input.metadata.planId ?? input.storedCheckout?.planId ?? input.existing?.planId,
    priceId: input.metadata.priceId ?? input.storedCheckout?.priceId ?? input.existing?.priceId,
  };
}

async function updateStoredCheckoutCompleted(
  db: Database,
  metadata: WaffoMetadata,
  providerEventAt: Date,
) {
  if (!metadata.checkoutSessionId) {
    return;
  }

  await db
    .update(billingCheckoutSession)
    .set({
      status: "completed",
      updatedAt: providerEventAt,
    })
    .where(
      and(
        eq(billingCheckoutSession.provider, "waffo"),
        eq(billingCheckoutSession.id, metadata.checkoutSessionId),
      ),
    );
}

async function upsertWaffoCustomer(
  db: Database,
  input: {
    user: BillingUser;
    providerCustomerId: string;
    email: string | null;
  },
) {
  await upsertBillingCustomer(db, {
    user: input.user,
    provider: "waffo",
    providerCustomerId: input.providerCustomerId,
    email: input.email,
  });
}

async function upsertWaffoPurchase(
  db: Database,
  input: {
    user: BillingUser;
    providerEventAt: Date;
    providerPaymentId: string;
    planId: string;
    priceId: string;
    status: "succeeded" | "refunded";
  },
) {
  const existing = await findPurchaseByProviderIntent(db, "waffo", input.providerPaymentId);
  if (
    existing?.providerEventAt &&
    input.providerEventAt.getTime() < existing.providerEventAt.getTime()
  ) {
    return;
  }

  const now = new Date();
  await db
    .insert(billingPurchase)
    .values({
      id: crypto.randomUUID(),
      userId: input.user.userId,
      provider: "waffo",
      providerPaymentIntentId: input.providerPaymentId,
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
    await reconcileActivatedPriceWithExistingSubscriptions(db, input.user, input.priceId, "waffo");
  }
}

function mapSubscriptionState(eventType: WaffoEvent["eventType"], orderStatus?: string) {
  const normalizedOrderStatus = orderStatus?.toLowerCase();
  if (eventType === WebhookEventType.SubscriptionPastDue || normalizedOrderStatus === "past_due") {
    return {
      status: "past_due" as WaffoSubscriptionStatus,
      cancelAtPeriodEnd: false,
    };
  }

  if (eventType === WebhookEventType.SubscriptionCanceled || normalizedOrderStatus === "canceled") {
    return {
      status: "canceled" as WaffoSubscriptionStatus,
      cancelAtPeriodEnd: false,
    };
  }

  return {
    status: "active" as WaffoSubscriptionStatus,
    cancelAtPeriodEnd:
      eventType === WebhookEventType.SubscriptionCanceling || normalizedOrderStatus === "canceling",
  };
}

async function upsertWaffoSubscription(
  db: Database,
  input: {
    user: BillingUser;
    data: WebhookEventData;
    eventType: WaffoEvent["eventType"];
    providerEventAt: Date;
    providerCustomerId: string;
    planId: string;
    priceId: string;
  },
) {
  const existing = await findSubscriptionByProviderId(db, "waffo", input.data.orderId);
  if (
    existing?.providerEventAt &&
    input.providerEventAt.getTime() < existing.providerEventAt.getTime()
  ) {
    return;
  }

  const mappedState = mapSubscriptionState(input.eventType, input.data.orderStatus);
  const now = new Date();
  await db
    .insert(billingSubscription)
    .values({
      id: crypto.randomUUID(),
      userId: input.user.userId,
      provider: "waffo",
      providerSubscriptionId: input.data.orderId,
      providerCustomerId: input.providerCustomerId,
      planId: input.planId,
      priceId: input.priceId,
      status: mappedState.status,
      currentPeriodEnd: toDate(input.data.currentPeriodEnd),
      cancelAtPeriodEnd: mappedState.cancelAtPeriodEnd,
      startedAt: toDate(input.data.currentPeriodStart),
      endedAt:
        mappedState.status === "canceled"
          ? (toDate(input.data.canceledAt) ?? input.providerEventAt)
          : null,
      providerEventAt: input.providerEventAt,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [billingSubscription.provider, billingSubscription.providerSubscriptionId],
      set: {
        userId: input.user.userId,
        providerCustomerId: input.providerCustomerId,
        planId: input.planId,
        priceId: input.priceId,
        status: mappedState.status,
        currentPeriodEnd: toDate(input.data.currentPeriodEnd),
        cancelAtPeriodEnd: mappedState.cancelAtPeriodEnd,
        startedAt: toDate(input.data.currentPeriodStart),
        endedAt:
          mappedState.status === "canceled"
            ? (toDate(input.data.canceledAt) ?? input.providerEventAt)
            : null,
        providerEventAt: input.providerEventAt,
        updatedAt: now,
      },
    });

  if (mappedState.status === "active") {
    await reconcileActivatedPriceWithExistingSubscriptions(db, input.user, input.priceId, "waffo");
  }
}

async function handleOrderCompleted(db: Database, event: WaffoEvent) {
  const metadata = resolveMetadata(event.data);
  const storedCheckout = await findStoredCheckout(db, metadata);
  const user = await resolveUser(db, {
    data: event.data,
    metadata,
    storedCheckout,
  });
  if (!user) {
    throw new Error(`Waffo order completed missing billing user for order ${event.data.orderId}`);
  }

  const providerEventAt = resolveProviderEventAt(event);
  const providerCustomerId = resolveProviderCustomerId(event.data, user);
  await upsertWaffoCustomer(db, {
    user,
    providerCustomerId,
    email: event.data.buyerEmail ?? null,
  });
  await updateStoredCheckoutCompleted(db, metadata, providerEventAt);

  const providerPaymentId = event.data.paymentId ?? event.eventId ?? event.data.orderId;
  if (metadata.kind === "credit_purchase") {
    const creditPackageId = metadata.creditPackageId;
    const creditOrderId = metadata.creditOrderId;
    if (!creditPackageId) {
      throw new Error(`Waffo credit checkout missing package id for order ${event.data.orderId}`);
    }

    if (creditOrderId) {
      await completeCreditOrderPurchase(db, {
        orderId: creditOrderId,
        sourceProvider: "waffo",
        sourceId: providerPaymentId,
        providerPaymentId,
        metadata: {
          orderId: event.data.orderId,
          providerEventId: event.id,
          paymentId: event.data.paymentId ?? null,
        },
      });
      return;
    }

    await grantCreditPackagePurchase(db, {
      user,
      packageId: creditPackageId,
      sourceProvider: "waffo",
      sourceId: providerPaymentId,
      metadata: {
        orderId: event.data.orderId,
        providerEventId: event.id,
        paymentId: event.data.paymentId ?? null,
      },
    });
    return;
  }

  const { planId, priceId } = resolvePlanPrice({ metadata, storedCheckout });
  if (!planId || !priceId) {
    throw new Error(
      `Waffo order completed missing plan or price mapping for order ${event.data.orderId}`,
    );
  }

  const price = findPriceById(priceId);
  if (!price || price.priceType !== "lifetime") {
    return;
  }

  await upsertWaffoPurchase(db, {
    user,
    providerEventAt,
    providerPaymentId,
    planId,
    priceId,
    status: "succeeded",
  });
}

async function handleSubscriptionEvent(db: Database, event: WaffoEvent) {
  const metadata = resolveMetadata(event.data);
  const storedCheckout = await findStoredCheckout(db, metadata);
  const existing = await findSubscriptionByProviderId(db, "waffo", event.data.orderId);
  const user =
    (await resolveUser(db, {
      data: event.data,
      metadata,
      storedCheckout,
    })) ?? (existing ? { userId: existing.userId } : null);
  if (!user) {
    console.error("Waffo subscription event missing billing user", {
      providerEventId: event.id,
      providerSubscriptionId: event.data.orderId,
      metadata,
    });
    return;
  }

  const { planId, priceId } = resolvePlanPrice({ metadata, storedCheckout, existing });
  if (!planId || !priceId) {
    throw new Error(
      `Waffo subscription event missing plan or price mapping for order ${event.data.orderId}`,
    );
  }

  const providerEventAt = resolveProviderEventAt(event);
  const providerCustomerId = resolveProviderCustomerId(event.data, user);
  await upsertWaffoCustomer(db, {
    user,
    providerCustomerId,
    email: event.data.buyerEmail ?? null,
  });
  await updateStoredCheckoutCompleted(db, metadata, providerEventAt);
  await upsertWaffoSubscription(db, {
    user,
    data: event.data,
    eventType: event.eventType,
    providerEventAt,
    providerCustomerId,
    planId,
    priceId,
  });
}

async function handleRefundSucceeded(db: Database, event: WaffoEvent) {
  const providerEventAt = resolveProviderEventAt(event);
  const providerPaymentId = event.data.paymentId ?? event.data.orderId;
  const refundSourceId = event.eventId ?? event.id;

  const revokedCreditPurchase = await revokeCreditPurchaseBySource(db, {
    originalSourceProvider: "waffo",
    originalSourceId: providerPaymentId,
    refundSourceId,
    metadata: {
      providerEventId: event.id,
      orderId: event.data.orderId,
      paymentId: event.data.paymentId ?? null,
    },
  });
  const markedCreditOrder = await markCreditOrderRefunded(db, {
    sourceProvider: "waffo",
    providerPaymentId,
  });
  if (revokedCreditPurchase || markedCreditOrder) {
    return;
  }

  const purchase = await findPurchaseByProviderIntent(db, "waffo", providerPaymentId);
  if (!purchase) {
    return;
  }

  await upsertWaffoPurchase(db, {
    user: { userId: purchase.userId },
    providerEventAt,
    providerPaymentId,
    planId: purchase.planId,
    priceId: purchase.priceId,
    status: "refunded",
  });
}

export async function handleWaffoEvent(db: Database, payload: unknown) {
  const event = payload as WaffoEvent;

  switch (event.eventType) {
    case WebhookEventType.OrderCompleted:
      await handleOrderCompleted(db, event);
      return;
    case WebhookEventType.SubscriptionActivated:
    case WebhookEventType.SubscriptionPaymentSucceeded:
    case WebhookEventType.SubscriptionCanceling:
    case WebhookEventType.SubscriptionUncanceled:
    case WebhookEventType.SubscriptionUpdated:
    case WebhookEventType.SubscriptionCanceled:
    case WebhookEventType.SubscriptionPastDue:
      await handleSubscriptionEvent(db, event);
      return;
    case WebhookEventType.RefundSucceeded:
      await handleRefundSucceeded(db, event);
      return;
    case WebhookEventType.RefundFailed:
      return;
  }
}
