import { env } from "cloudflare:workers";
import Stripe from "stripe";
import type {
  CreateCheckoutInput,
  CreatePortalInput,
  ParsedWebhookEvent,
  PaymentProvider,
  WebhookInput,
} from "../../public/types";

/**
 * Reads Stripe webhook secret from runtime environment.
 *
 * @returns Stripe webhook secret.
 */
function requireWebhookSecret() {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }
  return env.STRIPE_WEBHOOK_SECRET;
}

/**
 * Reads Stripe secret API key from runtime environment.
 *
 * @returns Stripe secret key.
 */
function requireStripeSecretKey() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return env.STRIPE_SECRET_KEY;
}

/**
 * Normalizes metadata according to Stripe API requirements.
 *
 * @param metadata - Metadata payload.
 * @returns Undefined when metadata is empty.
 */
function normalizeMetadata(metadata?: Record<string, string>) {
  return metadata && Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Creates Stripe payment provider implementation.
 *
 * @returns Stripe payment provider.
 */
export function createStripePaymentProvider(): PaymentProvider {
  const stripe = new Stripe(requireStripeSecretKey());

  return {
    key: "stripe",

    /**
     * Creates a Stripe checkout session.
     *
     * @param input - Checkout input payload.
     * @returns Checkout session result.
     */
    async createCheckoutSession(input: CreateCheckoutInput) {
      const customerParams = input.customerId
        ? { customer: input.customerId }
        : input.customerEmail
          ? { customer_email: input.customerEmail }
          : {};

      const session = await stripe.checkout.sessions.create({
        mode: input.mode,
        line_items: input.lineItems.map((item) => ({
          price: item.priceId,
          quantity: item.quantity,
        })),
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        ...customerParams,
        metadata: normalizeMetadata(input.metadata),
        subscription_data:
          input.mode === "subscription"
            ? {
                metadata: normalizeMetadata(input.metadata),
                trial_period_days: input.trialDays ?? undefined,
              }
            : undefined,
        payment_intent_data:
          input.mode === "payment" ? { metadata: normalizeMetadata(input.metadata) } : undefined,
      });

      if (!session.url) {
        throw new Error("Stripe Checkout session missing URL");
      }

      return {
        providerSessionId: session.id,
        url: session.url,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
      };
    },

    /**
     * Creates a Stripe billing portal session.
     *
     * @param input - Portal input payload.
     * @returns Portal session result.
     */
    async createPortalSession(input: CreatePortalInput) {
      const session = await stripe.billingPortal.sessions.create({
        customer: input.customerId,
        return_url: input.returnUrl,
      });

      return {
        providerSessionId: session.id,
        url: session.url,
      };
    },

    /**
     * Sets cancel-at-period-end on a Stripe subscription.
     *
     * @param input - Subscription cancellation behavior payload.
     */
    async setSubscriptionCancelAtPeriodEnd(input) {
      await stripe.subscriptions.update(input.subscriptionId, {
        cancel_at_period_end: input.cancelAtPeriodEnd,
      });
    },

    /**
     * Updates a Stripe subscription to use a new price.
     *
     * @param input - Subscription upgrade payload.
     */
    async updateSubscriptionPlan(input) {
      const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
      const subscriptionItemId = subscription.items.data.at(0)?.id;
      if (!subscriptionItemId) {
        throw new Error("Stripe subscription item not found");
      }

      await stripe.subscriptions.update(input.subscriptionId, {
        items: [
          {
            id: subscriptionItemId,
            price: input.targetPriceId,
          },
        ],
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
        cancel_at_period_end: false,
      });
    },

    /**
     * Verifies and parses Stripe webhook payload.
     *
     * @param input - Raw webhook request payload.
     * @returns Parsed webhook event.
     */
    async parseWebhookEvent(input: WebhookInput): Promise<ParsedWebhookEvent> {
      const signature = input.signature ?? undefined;
      if (!signature) {
        throw new Error("Missing Stripe webhook signature");
      }

      const event = await stripe.webhooks.constructEventAsync(
        input.rawBody,
        signature,
        requireWebhookSecret(),
      );

      return {
        providerEventId: event.id,
        type: event.type,
        createdAt: new Date(event.created * 1000),
        payload: event,
      };
    },
  };
}
