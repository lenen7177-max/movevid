import { env } from "cloudflare:workers";
import { HTTPException } from "hono/http-exception";
import type {
  CreateCheckoutInput,
  CreatePortalInput,
  ParsedWebhookEvent,
  PaymentProvider,
  WebhookInput,
} from "../../public/types";
import {
  createCreemApiHeaders,
  pickCreemProductId,
  resolveCreemCheckoutCustomer,
  resolveCreemApiBaseUrl,
  verifyCreemWebhookSignature,
} from "./shared";
import type {
  CreemCreateCheckoutResponse,
  CreemCreateCustomerBillingResponse,
  CreemWebhookEnvelope,
} from "./types";

function requireCreemApiKey() {
  if (!env.CREEM_API_KEY) {
    throw new Error("CREEM_API_KEY is not configured");
  }

  return env.CREEM_API_KEY;
}

function requireCreemWebhookSecret() {
  if (!env.CREEM_WEBHOOK_SECRET) {
    throw new Error("Missing CREEM_WEBHOOK_SECRET");
  }

  return env.CREEM_WEBHOOK_SECRET;
}

async function creemRequest<T>(path: string, init: { method: "POST"; body?: unknown }) {
  const apiKey = requireCreemApiKey();
  const response = await fetch(`${resolveCreemApiBaseUrl(apiKey)}${path}`, {
    method: init.method,
    headers: createCreemApiHeaders(apiKey),
    ...("body" in init ? { body: JSON.stringify(init.body) } : {}),
  });

  if (!response.ok) {
    throw new Error(`Creem request failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as T;
}

function parseCreemWebhook(rawBody: string) {
  const payload = JSON.parse(rawBody) as CreemWebhookEnvelope;

  if (!payload.id || !payload.eventType) {
    throw new Error("Invalid Creem webhook payload");
  }

  return payload;
}

export function createCreemPaymentProvider(): PaymentProvider {
  return {
    key: "creem",

    async createCheckoutSession(input: CreateCheckoutInput) {
      const productId = pickCreemProductId(input.lineItems);
      const lineItem = input.lineItems[0]!;
      const customer = resolveCreemCheckoutCustomer(input);

      const session = await creemRequest<CreemCreateCheckoutResponse>("/checkouts", {
        method: "POST",
        body: {
          product_id: productId,
          request_id: crypto.randomUUID(),
          units: lineItem.quantity,
          success_url: input.successUrl,
          metadata: input.metadata,
          ...(customer ? { customer } : {}),
        },
      });

      return {
        providerSessionId: session.id,
        url: session.checkout_url,
        expiresAt: session.expires_at ? new Date(session.expires_at) : null,
      };
    },

    async createPortalSession(input: CreatePortalInput) {
      const session = await creemRequest<CreemCreateCustomerBillingResponse>("/customers/billing", {
        method: "POST",
        body: {
          customer_id: input.customerId,
        },
      });

      return {
        providerSessionId: input.customerId,
        url: session.customer_portal_link,
      };
    },

    async setSubscriptionCancelAtPeriodEnd(input) {
      if (!input.cancelAtPeriodEnd) {
        await creemRequest(`/subscriptions/${input.subscriptionId}/resume`, {
          method: "POST",
        });
        return;
      }

      await creemRequest(`/subscriptions/${input.subscriptionId}/cancel`, {
        method: "POST",
        body: {
          mode: "scheduled",
          onExecute: "cancel",
        },
      });
    },

    async updateSubscriptionPlan(input) {
      await creemRequest(`/subscriptions/${input.subscriptionId}/upgrade`, {
        method: "POST",
        body: {
          product_id: input.targetPriceId,
          update_behavior: "proration-charge-immediately",
        },
      });
    },

    async parseWebhookEvent(input: WebhookInput): Promise<ParsedWebhookEvent> {
      const signature = input.signature?.trim();
      if (!signature) {
        throw new HTTPException(401, {
          message: "Missing Creem webhook signature",
        });
      }

      const signatureValid = verifyCreemWebhookSignature({
        rawBody: input.rawBody,
        signature,
        secret: requireCreemWebhookSecret(),
      });

      if (!signatureValid) {
        throw new HTTPException(401, {
          message: "Invalid Creem webhook signature",
        });
      }

      const payload = parseCreemWebhook(input.rawBody);

      return {
        providerEventId: payload.id,
        type: payload.eventType,
        createdAt: new Date(payload.created_at),
        payload,
      };
    },
  };
}
