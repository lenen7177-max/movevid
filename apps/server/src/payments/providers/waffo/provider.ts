import { env } from "cloudflare:workers";
import { WaffoPancake, verifyWebhook, type WebhookEventData } from "@waffo/pancake-ts";
import type {
  CreateCheckoutInput,
  ParsedWebhookEvent,
  PaymentProvider,
  WebhookInput,
} from "../../public/types";

type WaffoEnvironment = "test" | "prod";

function requireWaffoMerchantId() {
  const merchantId = env.WAFFO_MERCHANT_ID?.trim();
  if (!merchantId) {
    throw new Error("WAFFO_MERCHANT_ID is not configured");
  }

  if (!merchantId.startsWith("MER_")) {
    throw new Error("WAFFO_MERCHANT_ID must be a Waffo Merchant ID starting with MER_");
  }

  return merchantId;
}

function requireWaffoPrivateKey() {
  if (!env.WAFFO_PRIVATE_KEY) {
    throw new Error("WAFFO_PRIVATE_KEY is not configured");
  }

  return env.WAFFO_PRIVATE_KEY;
}

function resolveWaffoEnvironment(): WaffoEnvironment {
  return env.WAFFO_ENVIRONMENT === "prod" ? "prod" : "test";
}

function pickWaffoProductId(input: CreateCheckoutInput) {
  const lineItem = input.lineItems[0];
  if (!lineItem || input.lineItems.length !== 1) {
    throw new Error("Waffo checkout requires exactly one line item");
  }

  return lineItem.priceId;
}

function requireCheckoutCurrency(input: CreateCheckoutInput) {
  if (!input.currency) {
    throw new Error("Waffo checkout requires a currency");
  }

  return input.currency.toUpperCase();
}

function createWaffoClient() {
  const merchantId = requireWaffoMerchantId();
  const privateKey = requireWaffoPrivateKey();

  return new WaffoPancake({
    merchantId,
    privateKey,
  });
}

export function createWaffoPaymentProvider(): PaymentProvider {
  const client = createWaffoClient();

  return {
    key: "waffo",

    async createCheckoutSession(input: CreateCheckoutInput) {
      const productId = pickWaffoProductId(input);
      const buyerIdentity =
        input.metadata?.userId ?? input.customerId ?? input.customerEmail ?? null;

      const checkoutInput = {
        productId,
        currency: requireCheckoutCurrency(input),
        successUrl: input.successUrl,
        metadata: input.metadata,
        ...(input.customerEmail ? { buyerEmail: input.customerEmail } : {}),
        ...(input.trialDays ? { withTrial: true } : {}),
      };

      const session = buyerIdentity
        ? await client.checkout.authenticated.create({
            ...checkoutInput,
            buyerIdentity,
          })
        : await client.checkout.createSession(checkoutInput);

      return {
        providerSessionId: session.sessionId,
        url: session.checkoutUrl,
        expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
      };
    },

    async createPortalSession() {
      return {
        providerSessionId: "waffo-consumer-portal",
        url: "https://pancake.waffo.ai/consumer/portal/login",
      };
    },

    async setSubscriptionCancelAtPeriodEnd(input) {
      if (!input.cancelAtPeriodEnd) {
        throw new Error("Waffo subscription reactivation must be completed by the buyer");
      }

      await client.orders.cancelSubscription({
        orderId: input.subscriptionId,
      });
    },

    async updateSubscriptionPlan() {
      throw new Error("Waffo provider does not support direct subscription plan updates yet");
    },

    async parseWebhookEvent(input: WebhookInput): Promise<ParsedWebhookEvent> {
      const event = verifyWebhook<WebhookEventData>(input.rawBody, input.signature, {
        environment: resolveWaffoEnvironment(),
      });

      return {
        providerEventId: event.id,
        type: event.eventType,
        createdAt: new Date(event.timestamp),
        payload: event,
      };
    },
  };
}
