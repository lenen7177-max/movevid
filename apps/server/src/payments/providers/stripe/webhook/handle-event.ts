import type Stripe from "stripe";
import type { Database } from "@/db";
import {
  handleStripeCheckoutAsyncPaymentFailed,
  handleStripeCheckoutAsyncPaymentSucceeded,
  handleStripeCheckoutCompleted,
  handleStripeCheckoutExpired,
} from "./checkout-events";
import {
  handleStripeInvoiceMarkedUncollectible,
  handleStripeInvoicePaid,
  handleStripeInvoicePaymentFailed,
  handleStripeInvoiceVoided,
} from "./invoice-events";
import {
  handleStripeChargeDisputeClosed,
  handleStripeChargeDisputeCreated,
  handleStripeChargeDisputeUpdated,
  handleStripeChargeRefunded,
  handleStripePaymentIntentCanceled,
  handleStripePaymentIntentFailed,
  handleStripePaymentIntentSucceeded,
} from "./payment-events";
import { handleStripeSubscription } from "./subscription-events";

/**
 * Routes Stripe webhook events to domain-specific handlers.
 */
export async function handleStripeEvent(db: Database, payload: unknown) {
  const event = payload as Stripe.Event;
  const providerEventAt = new Date(event.created * 1000);
  switch (event.type) {
    case "checkout.session.completed": {
      await handleStripeCheckoutCompleted(
        db,
        event.data.object as Stripe.Checkout.Session,
        providerEventAt,
      );
      return;
    }
    case "checkout.session.async_payment_succeeded": {
      await handleStripeCheckoutAsyncPaymentSucceeded(
        db,
        event.data.object as Stripe.Checkout.Session,
        providerEventAt,
      );
      return;
    }
    case "checkout.session.async_payment_failed": {
      await handleStripeCheckoutAsyncPaymentFailed(
        db,
        event.data.object as Stripe.Checkout.Session,
        providerEventAt,
      );
      return;
    }
    case "checkout.session.expired": {
      await handleStripeCheckoutExpired(
        db,
        event.data.object as Stripe.Checkout.Session,
        providerEventAt,
      );
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await handleStripeSubscription(db, event.data.object as Stripe.Subscription, providerEventAt);
      return;
    }
    case "payment_intent.succeeded": {
      await handleStripePaymentIntentSucceeded(
        db,
        event.data.object as Stripe.PaymentIntent,
        providerEventAt,
      );
      return;
    }
    case "payment_intent.payment_failed": {
      await handleStripePaymentIntentFailed(
        db,
        event.data.object as Stripe.PaymentIntent,
        providerEventAt,
      );
      return;
    }
    case "payment_intent.canceled": {
      await handleStripePaymentIntentCanceled(
        db,
        event.data.object as Stripe.PaymentIntent,
        providerEventAt,
      );
      return;
    }
    case "invoice.paid":
    case "invoice.payment_succeeded": {
      await handleStripeInvoicePaid(db, event.data.object as Stripe.Invoice, providerEventAt);
      return;
    }
    case "invoice.payment_failed": {
      await handleStripeInvoicePaymentFailed(
        db,
        event.data.object as Stripe.Invoice,
        providerEventAt,
      );
      return;
    }
    case "invoice.marked_uncollectible": {
      await handleStripeInvoiceMarkedUncollectible(
        db,
        event.data.object as Stripe.Invoice,
        providerEventAt,
      );
      return;
    }
    case "invoice.voided": {
      await handleStripeInvoiceVoided(db, event.data.object as Stripe.Invoice, providerEventAt);
      return;
    }
    case "charge.dispute.updated": {
      await handleStripeChargeDisputeUpdated(
        db,
        event.data.object as Stripe.Dispute,
        providerEventAt,
      );
      return;
    }
    case "charge.dispute.created": {
      await handleStripeChargeDisputeCreated(
        db,
        event.data.object as Stripe.Dispute,
        providerEventAt,
      );
      return;
    }
    case "charge.dispute.closed": {
      await handleStripeChargeDisputeClosed(
        db,
        event.data.object as Stripe.Dispute,
        providerEventAt,
      );
      return;
    }
    case "charge.refunded": {
      await handleStripeChargeRefunded(db, event.data.object as Stripe.Charge, providerEventAt);
      return;
    }
    default:
      return;
  }
}
