import type { CreemSubscriptionState } from "./shared";

/**
 * Arbitrary metadata attached to Creem resources.
 */
export type CreemMetadata = Record<string, string>;

/**
 * Minimal customer details returned in Creem API and webhook payloads.
 */
export type CreemCustomer = {
  /** The unique Creem customer ID. */
  id: string;
  /** The customer's email address, when available. */
  email?: string | null;
} | null;

export type CreemCustomerReference = CreemCustomer | string;

/**
 * Minimal product details returned in Creem API and webhook payloads.
 */
export type CreemProduct = {
  /** The unique Creem product ID. */
  id: string;
  /** The product billing mode, such as recurring or one-time. */
  billing_type?: "recurring" | "one_time" | string;
} | null;

export type CreemProductReference = CreemProduct | string;

/**
 * Minimal subscription payload shape used by the Creem integration.
 */
export type CreemSubscription = {
  /** The unique Creem subscription ID. */
  id: string;
  /** The current lifecycle state of the subscription. */
  status: CreemSubscriptionState;
  /** The customer associated with the subscription. */
  customer: CreemCustomerReference;
  /** The subscribed product. */
  product: CreemProductReference;
  /** Integration metadata attached to the subscription. */
  metadata?: CreemMetadata | null;
  /** ISO date for the current billing period start. */
  current_period_start_date?: string | null;
  /** ISO date for the current billing period end. */
  current_period_end_date?: string | null;
  /** ISO date for when the subscription was canceled, if applicable. */
  canceled_at?: string | null;
};

/**
 * One-time order information included in checkout completion payloads.
 */
export type CreemOrder = {
  /** The unique Creem order ID. */
  id: string;
  /** The related transaction ID, when present. */
  transaction?: string | null;
  /** The customer who placed the order. */
  customer: CreemCustomerReference;
  /** The purchased product. */
  product: CreemProductReference;
  /** Integration metadata attached to the order. */
  metadata?: CreemMetadata | null;
};

/**
 * Payload object for the checkout completion webhook event.
 */
export type CreemCheckoutCompletedObject = {
  /** The unique checkout/session ID. */
  id: string;
  /** Integration metadata attached during checkout creation. */
  metadata?: CreemMetadata | null;
  /** The customer who completed the checkout. */
  customer?: CreemCustomer;
  /** The product involved in the checkout. */
  product?: CreemProduct;
  /** The resulting subscription for recurring purchases. */
  subscription?: CreemSubscription | null;
  /** The resulting order for one-time purchases. */
  order?: CreemOrder | null;
};

/**
 * Payload object for refund webhook events.
 */
export type CreemRefundObject = {
  /** The unique refund ID. */
  id: string;
  /** The customer receiving the refund. */
  customer?: CreemCustomerReference;
  /** The related subscription, if the refund came from a subscription charge. */
  subscription?: {
    /** The unique Creem subscription ID. */
    id: string;
    /** The current lifecycle state of the subscription. */
    status: CreemSubscriptionState;
    /** Integration metadata attached to the subscription. */
    metadata?: CreemMetadata | null;
    /** The customer associated with the subscription. */
    customer?: CreemCustomerReference;
  } | null;
  /** The related checkout, when available. */
  checkout?: {
    /** The unique checkout/session ID. */
    id: string;
    /** Integration metadata attached during checkout creation. */
    metadata?: CreemMetadata | null;
    /** The customer who completed the checkout. */
    customer?: CreemCustomerReference;
  } | null;
  /** The related order, when available. */
  order?: {
    /** The unique order ID. */
    id: string;
    /** Integration metadata attached to the order. */
    metadata?: CreemMetadata | null;
    /** The customer who placed the order. */
    customer?: CreemCustomerReference;
  } | null;
  /** The refunded transaction details. */
  transaction: {
    /** The unique Creem transaction ID. */
    id: string;
  };
};

/**
 * Payload object for dispute webhook events.
 */
export type CreemDisputeObject = {
  /** The unique dispute ID. */
  id: string;
  /** The customer associated with the dispute, when present. */
  customer?: CreemCustomerReference;
};

/**
 * Top-level Creem webhook request payload.
 */
export type CreemWebhookEnvelope = {
  /** The unique webhook event ID. */
  id: string;
  /** The type of webhook event emitted by Creem. */
  eventType:
    /** A hosted checkout session completed successfully. */
    | "checkout.completed"
    /** A subscription became active. */
    | "subscription.active"
    /** A subscription entered trial mode. */
    | "subscription.trialing"
    /** A recurring subscription payment was collected. */
    | "subscription.paid"
    /** A subscription is scheduled to cancel at period end. */
    | "subscription.scheduled_cancel"
    /** A subscription payment is overdue. */
    | "subscription.past_due"
    /** A subscription was updated, such as a plan or status change. */
    | "subscription.update"
    /** A subscription reached its expiration date. */
    | "subscription.expired"
    /** A subscription was canceled. */
    | "subscription.canceled"
    /** A subscription was paused. */
    | "subscription.paused"
    /** A refund was created for a transaction. */
    | "refund.created"
    /** A payment dispute or chargeback was opened. */
    | "dispute.created";
  /** ISO timestamp for when the event was created. */
  created_at: string | number;
  /** The event-specific payload object. */
  object: CreemCheckoutCompletedObject | CreemSubscription | CreemRefundObject | CreemDisputeObject;
};

/**
 * Response payload returned after creating a hosted checkout session.
 */
export type CreemCreateCheckoutResponse = {
  /** The unique checkout session ID. */
  id: string;
  /** The hosted Creem checkout URL. */
  checkout_url: string;
  /** ISO timestamp for when the checkout link expires, if provided. */
  expires_at?: string | null;
};

/**
 * Response payload returned when generating a customer billing portal link.
 */
export type CreemCreateCustomerBillingResponse = {
  /** The hosted customer billing portal URL. */
  customer_portal_link: string;
};

export function getCreemCustomerId(customer: CreemCustomerReference | undefined) {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

export function getCreemCustomerEmail(customer: CreemCustomerReference | undefined) {
  if (!customer || typeof customer === "string") {
    return null;
  }

  return customer.email ?? null;
}

export function getCreemProductId(product: CreemProductReference | undefined) {
  if (!product) {
    return null;
  }

  return typeof product === "string" ? product : product.id;
}
