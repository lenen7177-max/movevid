import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { Database } from "@/db";
import { billingSubscription } from "@/db/schema/payments";
import { findSubscriptionByProviderId } from "../../../infrastructure/repositories/billing-store";

export async function handleStripeInvoicePaid(
  db: Database,
  invoice: Stripe.Invoice,
  providerEventAt: Date,
) {
  await updateSubscriptionFromInvoice(db, invoice, "active", providerEventAt);
}

/**
 * Handles invoice.payment_failed.
 */
export async function handleStripeInvoicePaymentFailed(
  db: Database,
  invoice: Stripe.Invoice,
  providerEventAt: Date,
) {
  await updateSubscriptionFromInvoice(db, invoice, "past_due", providerEventAt);
}

/**
 * Handles invoice.marked_uncollectible.
 */
export async function handleStripeInvoiceMarkedUncollectible(
  db: Database,
  invoice: Stripe.Invoice,
  providerEventAt: Date,
) {
  await updateSubscriptionFromInvoice(db, invoice, "unpaid", providerEventAt);
}

/**
 * Handles invoice.voided.
 */
export async function handleStripeInvoiceVoided(
  db: Database,
  invoice: Stripe.Invoice,
  providerEventAt: Date,
) {
  await updateSubscriptionFromInvoice(db, invoice, "unpaid", providerEventAt);
}

/**
 * Updates local subscription rows from invoice lifecycle events.
 */
async function updateSubscriptionFromInvoice(
  db: Database,
  invoice: Stripe.Invoice,
  status: "active" | "past_due" | "unpaid",
  providerEventAt: Date,
) {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  if (!subscriptionRef) return;
  const providerSubscriptionId =
    typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef.id;
  if (!providerSubscriptionId) return;

  const existing = await findSubscriptionByProviderId(db, "stripe", providerSubscriptionId);
  if (!existing || existing.status === "canceled") return;
  if (existing.providerEventAt && providerEventAt.getTime() < existing.providerEventAt.getTime()) {
    return;
  }

  const now = new Date();
  const linePeriodEnd = invoice.lines?.data?.at(0)?.period?.end;
  const currentPeriodEnd =
    typeof linePeriodEnd === "number" ? new Date(linePeriodEnd * 1000) : null;

  await db
    .update(billingSubscription)
    .set({
      status,
      currentPeriodEnd: currentPeriodEnd ?? existing.currentPeriodEnd,
      providerEventAt,
      updatedAt: now,
    })
    .where(eq(billingSubscription.id, existing.id));
}
