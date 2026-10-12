import { createHmac, timingSafeEqual } from "node:crypto";
import type { SubscriptionStatus } from "@repo/app-config/payments/web";
import type { CheckoutLineItem, CreateCheckoutInput } from "../../public/types";

export type CreemSubscriptionState =
  | "active"
  | "trialing"
  | "scheduled_cancel"
  | "paused"
  | "past_due"
  | "unpaid"
  | "incomplete"
  | "canceled"
  | "expired"
  | "failed";

type MappedCreemSubscriptionState = {
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
};

export function resolveCreemApiBaseUrl(apiKey: string) {
  if (apiKey.startsWith("creem_test_")) {
    return "https://test-api.creem.io/v1";
  }

  return "https://api.creem.io/v1";
}

export function createCreemApiHeaders(apiKey: string) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    "x-api-key": apiKey,
  };
}

export function resolveCreemCheckoutCustomer(input: CreateCheckoutInput) {
  if (input.customerId) {
    return { id: input.customerId };
  }

  if (input.customerEmail) {
    return { email: input.customerEmail };
  }

  return undefined;
}

export function pickCreemProductId(lineItems: CheckoutLineItem[]) {
  const productId = lineItems[0]?.priceId;
  if (!productId) {
    throw new Error("Creem checkout is missing checkout product");
  }

  return productId;
}

export function mapCreemSubscriptionState(
  state: CreemSubscriptionState,
): MappedCreemSubscriptionState {
  switch (state) {
    case "scheduled_cancel":
      return {
        status: "active",
        cancelAtPeriodEnd: true,
      };
    case "active":
      return {
        status: "active",
        cancelAtPeriodEnd: false,
      };
    case "trialing":
      return {
        status: "trialing",
        cancelAtPeriodEnd: false,
      };
    case "paused":
      return {
        status: "paused",
        cancelAtPeriodEnd: false,
      };
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "failed":
      return {
        status: "unpaid",
        cancelAtPeriodEnd: false,
      };
    case "canceled":
    case "expired":
      return {
        status: "canceled",
        cancelAtPeriodEnd: false,
      };
  }

  throw new Error(`Unsupported Creem subscription state: ${state}`);
}

export function verifyCreemWebhookSignature(input: {
  rawBody: string;
  signature: string;
  secret: string;
}) {
  const expected = createHmac("sha256", input.secret).update(input.rawBody).digest("hex");
  const hexPattern = /^[\da-f]+$/i;

  if (input.signature.length !== expected.length || !hexPattern.test(input.signature)) {
    return false;
  }

  const signatureBuffer = Buffer.from(input.signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}
