import type { ServerPaymentProviderKey } from "@repo/app-config";

/**
 * Billing user identity.
 */
export type BillingUser = {
  /** Internal user identifier. */
  userId: string;
};

/**
 * Checkout mode used by provider APIs.
 */
export type CheckoutMode = "subscription" | "payment";

/**
 * Line item used for creating provider checkout sessions.
 */
export type CheckoutLineItem = {
  /** Provider price identifier. */
  priceId: string;
  /** Quantity for the line item. */
  quantity: number;
};

/**
 * Input payload for creating a checkout session.
 */
export type CreateCheckoutInput = {
  /** Checkout mode. */
  mode: CheckoutMode;
  /** Line items for checkout. */
  lineItems: CheckoutLineItem[];
  /** Success redirect URL. */
  successUrl: string;
  /** Cancel redirect URL. */
  cancelUrl: string;
  /** Existing provider customer ID. */
  customerId?: string;
  /** Customer email for provider session creation. */
  customerEmail?: string;
  /** ISO currency code used by provider checkout when the provider requires it. */
  currency?: string;
  /** Custom metadata sent to the provider. */
  metadata?: Record<string, string>;
  /** Optional free-trial duration in days for subscription checkout. */
  trialDays?: number | null;
};

/**
 * Output payload returned after creating a checkout session.
 */
export type CheckoutSessionResult = {
  /** Provider session identifier. */
  providerSessionId: string;
  /** Redirect URL to provider checkout page. */
  url: string;
  /** Session expiration timestamp if provided by provider. */
  expiresAt?: Date | null;
};

/**
 * Input payload for creating a customer portal session.
 */
export type CreatePortalInput = {
  /** Provider customer identifier. */
  customerId: string;
  /** Return URL after leaving provider portal. */
  returnUrl: string;
};

/**
 * Output payload returned after creating a portal session.
 */
export type PortalSessionResult = {
  /** Provider portal session identifier. */
  providerSessionId: string;
  /** Redirect URL to provider portal. */
  url: string;
};

/**
 * Input payload for parsing webhook events.
 */
export type WebhookInput = {
  /** Provider signature or authorization header used to verify payload authenticity. */
  signature?: string | null;
  /** Raw webhook body from the HTTP request. */
  rawBody: string;
};

/**
 * Parsed provider webhook event in a normalized format.
 */
export type ParsedWebhookEvent = {
  /** Provider event identifier. */
  providerEventId: string;
  /** Provider event type name. */
  type: string;
  /** Provider event creation time. */
  createdAt: Date;
  /** Raw provider event payload. */
  payload: unknown;
};

/**
 * Input payload for toggling cancel-at-period-end behavior.
 */
export type SetSubscriptionCancelAtPeriodEndInput = {
  /** Provider subscription identifier. */
  subscriptionId: string;
  /** Target cancel-at-period-end flag. */
  cancelAtPeriodEnd: boolean;
};

/**
 * Input payload for updating a subscription to a new provider plan.
 */
export type UpdateSubscriptionPlanInput = {
  /** Provider subscription identifier. */
  subscriptionId: string;
  /** Target provider price identifier. */
  targetPriceId: string;
};

/**
 * Provider interface required by the payment application service.
 */
export type PaymentProvider = {
  /** Provider key. */
  key: ServerPaymentProviderKey;

  /**
   * Creates a checkout session.
   *
   * @param input - Checkout input payload.
   * @returns Checkout session result.
   */
  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResult>;

  /**
   * Creates a provider customer portal session.
   *
   * @param input - Portal input payload.
   * @returns Portal session result.
   */
  createPortalSession(input: CreatePortalInput): Promise<PortalSessionResult>;

  /**
   * Parses and verifies provider webhook payload.
   *
   * @param input - Raw webhook input.
   * @returns Parsed webhook event.
   */
  parseWebhookEvent(input: WebhookInput): Promise<ParsedWebhookEvent>;

  /**
   * Updates provider subscription renewal behavior.
   *
   * @param input - Cancel-at-period-end payload.
   */
  setSubscriptionCancelAtPeriodEnd(input: SetSubscriptionCancelAtPeriodEndInput): Promise<void>;

  /**
   * Updates provider subscription plan for in-app upgrades.
   *
   * @param input - Subscription plan update payload.
   */
  updateSubscriptionPlan(input: UpdateSubscriptionPlanInput): Promise<void>;
};
