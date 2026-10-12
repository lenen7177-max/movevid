import { and, eq, inArray } from "drizzle-orm";
import type { ServerPaymentProviderKey } from "@repo/app-config";
import type { Database } from "@/db";
import { billingCustomer, billingPurchase, billingSubscription } from "@/db/schema/payments";
import type { BillingUser } from "../../public/types";

/**
 * Supports both top-level DB clients and transaction-scoped clients.
 */
type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DbLike = Database | DbTransaction;

/**
 * Finds a billing customer by user and provider.
 */
async function findBillingCustomer(
  db: DbLike,
  input: {
    userId: string;
    provider: ServerPaymentProviderKey;
  },
) {
  const [customer] = await db
    .select()
    .from(billingCustomer)
    .where(
      and(eq(billingCustomer.userId, input.userId), eq(billingCustomer.provider, input.provider)),
    )
    .limit(1);
  return customer;
}

async function findBillingCustomerByProviderCustomerId(
  db: DbLike,
  input: {
    provider: ServerPaymentProviderKey;
    providerCustomerId: string;
  },
) {
  const [customer] = await db
    .select()
    .from(billingCustomer)
    .where(
      and(
        eq(billingCustomer.provider, input.provider),
        eq(billingCustomer.providerCustomerId, input.providerCustomerId),
      ),
    )
    .limit(1);
  return customer;
}

/**
 * Creates or updates billing customer mapping rows.
 */
async function upsertBillingCustomer(
  db: DbLike,
  input: {
    user: BillingUser;
    provider: ServerPaymentProviderKey;
    providerCustomerId: string;
    email: string | null;
  },
) {
  const now = new Date();
  const existingByProviderCustomerId = await findBillingCustomerByProviderCustomerId(db, {
    provider: input.provider,
    providerCustomerId: input.providerCustomerId,
  });

  if (existingByProviderCustomerId) {
    // A provider customer is the billing-system identity. When the same provider customer
    // appears under a different app user, automatically moving ownership can grant the new
    // user access to the old user's subscription, portal, refunds, and future webhook updates.
    //
    // This can happen in local testing when the same provider email/customer is reused across
    // app accounts, or in production when auth accounts were duplicated instead of merged.
    // Keep the original owner intact and log the conflict for manual account/customer cleanup.
    if (existingByProviderCustomerId.userId !== input.user.userId) {
      console.warn("Billing customer ownership conflict", {
        provider: input.provider,
        providerCustomerId: input.providerCustomerId,
        existingUserId: existingByProviderCustomerId.userId,
        incomingUserId: input.user.userId,
        existingEmail: existingByProviderCustomerId.email,
        incomingEmail: input.email,
      });
    }

    await db
      .update(billingCustomer)
      .set({
        email: input.email ?? existingByProviderCustomerId.email,
        updatedAt: now,
      })
      .where(eq(billingCustomer.id, existingByProviderCustomerId.id));
    return;
  }

  const existingByUser = await findBillingCustomer(db, {
    userId: input.user.userId,
    provider: input.provider,
  });

  if (!existingByUser) {
    await db.insert(billingCustomer).values({
      id: crypto.randomUUID(),
      userId: input.user.userId,
      provider: input.provider,
      providerCustomerId: input.providerCustomerId,
      email: input.email,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  await db
    .update(billingCustomer)
    .set({
      providerCustomerId: input.providerCustomerId,
      email: input.email ?? existingByUser.email,
      updatedAt: now,
    })
    .where(eq(billingCustomer.id, existingByUser.id));
}

/**
 * Finds a subscription row by provider subscription ID.
 */
async function findSubscriptionByProviderId(
  db: DbLike,
  provider: ServerPaymentProviderKey,
  providerSubscriptionId: string,
) {
  const [subscription] = await db
    .select()
    .from(billingSubscription)
    .where(
      and(
        eq(billingSubscription.provider, provider),
        eq(billingSubscription.providerSubscriptionId, providerSubscriptionId),
      ),
    )
    .limit(1);
  return subscription;
}

/**
 * Finds a purchase row by provider payment intent ID.
 */
async function findPurchaseByProviderIntent(
  db: DbLike,
  provider: ServerPaymentProviderKey,
  providerPaymentIntentId: string,
) {
  const [purchase] = await db
    .select()
    .from(billingPurchase)
    .where(
      and(
        eq(billingPurchase.provider, provider),
        eq(billingPurchase.providerPaymentIntentId, providerPaymentIntentId),
      ),
    )
    .limit(1);
  return purchase;
}

/**
 * Checks whether a user has historical subscription states that consume trial eligibility.
 */
async function hasTrialConsumingSubscriptionHistory(
  db: DbLike,
  input: {
    userId: string;
    provider: ServerPaymentProviderKey;
  },
) {
  const [subscription] = await db
    .select({
      id: billingSubscription.id,
    })
    .from(billingSubscription)
    .where(
      and(
        eq(billingSubscription.userId, input.userId),
        eq(billingSubscription.provider, input.provider),
        inArray(billingSubscription.status, [
          "trialing",
          "active",
          "past_due",
          "unpaid",
          "canceled",
        ]),
      ),
    )
    .limit(1);
  return Boolean(subscription);
}

export type { DbLike };
export {
  findBillingCustomer,
  findPurchaseByProviderIntent,
  findSubscriptionByProviderId,
  hasTrialConsumingSubscriptionHistory,
  upsertBillingCustomer,
};
