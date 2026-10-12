import { SUPPORTED_SERVER_PAYMENT_PROVIDERS } from "@repo/app-config";
import { SUBSCRIPTION_STATUSES } from "@repo/app-config/payments/web";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Billing customers table - maps internal users to payment provider customers
 * Maintains the relationship between our system and external payment providers
 */
export const billingCustomer = sqliteTable(
  "billing_customer",
  {
    id: text("id").primaryKey(), // Internal customer record ID
    userId: text("user_id").notNull(), // Internal user ID
    provider: text("provider", {
      enum: SUPPORTED_SERVER_PAYMENT_PROVIDERS,
    }).notNull(), // Payment provider
    providerCustomerId: text("provider_customer_id").notNull(), // Customer ID in provider's system
    email: text("email"), // Customer email address
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    // Each user can have only one customer record per provider
    uniqueIndex("billing_customer_user_provider_idx").on(table.userId, table.provider),
    // Each provider customer ID should be unique per provider
    uniqueIndex("billing_customer_provider_customer_id_idx").on(
      table.provider,
      table.providerCustomerId,
    ),
  ],
);

/**
 * Billing subscriptions table - tracks recurring subscription relationships
 * Stores subscription state and links to plans/prices
 */
export const billingSubscription = sqliteTable(
  "billing_subscription",
  {
    id: text("id").primaryKey(), // Internal subscription record ID
    userId: text("user_id").notNull(), // Internal user ID
    provider: text("provider", {
      enum: SUPPORTED_SERVER_PAYMENT_PROVIDERS,
    }).notNull(), // Payment provider handling subscription
    providerSubscriptionId: text("provider_subscription_id").notNull(), // Subscription ID in provider's system
    providerCustomerId: text("provider_customer_id").notNull(), // Customer ID in provider's system
    planId: text("plan_id").notNull(), // Reference to billing plan
    priceId: text("price_id").notNull(), // Reference to billing price
    status: text("status", {
      enum: SUBSCRIPTION_STATUSES,
    }).notNull(), // Current subscription status from provider
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }), // When current billing period ends
    cancelAtPeriodEnd: integer("cancel_at_period_end", {
      mode: "boolean",
    })
      .notNull()
      .default(false), // Whether subscription will cancel at period end
    startedAt: integer("started_at", { mode: "timestamp" }), // When subscription started
    endedAt: integer("ended_at", { mode: "timestamp" }), // When subscription ended (if applicable)
    providerEventAt: integer("provider_event_at", { mode: "timestamp" }), // Latest provider event timestamp applied to this subscription
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    // Each provider subscription ID should be unique per provider
    uniqueIndex("billing_subscription_provider_subscription_id_idx").on(
      table.provider,
      table.providerSubscriptionId,
    ),
    index("billing_subscription_user_updated_idx").on(table.userId, table.updatedAt),
    index("billing_subscription_status_updated_idx").on(table.status, table.updatedAt),
  ],
);

/**
 * Billing checkout sessions table - tracks payment initiation attempts
 * Records when users start the checkout process for audit and debugging
 */
export const billingCheckoutSession = sqliteTable(
  "billing_checkout_session",
  {
    id: text("id").primaryKey(), // Internal checkout session ID
    userId: text("user_id").notNull(), // Internal user ID
    provider: text("provider", {
      enum: SUPPORTED_SERVER_PAYMENT_PROVIDERS,
    }).notNull(), // Payment provider handling checkout
    providerSessionId: text("provider_session_id").notNull(), // Checkout session ID in provider's system
    planId: text("plan_id").notNull(), // Plan being purchased
    priceId: text("price_id").notNull(), // Price being purchased
    mode: text("mode", { enum: ["subscription", "payment"] }).notNull(), // Payment type
    status: text("status", { enum: ["created", "completed", "expired"] })
      .notNull()
      .default("created"), // Current status of checkout session
    expiresAt: integer("expires_at", { mode: "timestamp" }), // When checkout session expires
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    // Each provider session ID should be unique per provider
    uniqueIndex("billing_checkout_session_provider_session_id_idx").on(
      table.provider,
      table.providerSessionId,
    ),
  ],
);

/**
 * Billing events table - stores webhook events from payment providers
 * Used for idempotency and audit trail of all payment-related events
 */
export const billingEvent = sqliteTable(
  "billing_event",
  {
    id: text("id").primaryKey(), // Internal event record ID
    provider: text("provider", {
      enum: SUPPORTED_SERVER_PAYMENT_PROVIDERS,
    }).notNull(), // Payment provider that sent the event
    providerEventId: text("provider_event_id").notNull(), // Event ID from provider (for idempotency)
    eventType: text("event_type").notNull(), // Type of event (e.g., "invoice.paid")
    processedAt: integer("processed_at", { mode: "timestamp" }).notNull(), // When we processed the event
    payloadJson: text("payload_json").notNull(), // Full event payload as JSON
    // Processing state for at-least-once delivery. `pending` rows allow providers to safely
    // retry failed handler runs because they stay re-processable until marked `processed`.
    processingStatus: text("processing_status", {
      enum: ["pending", "processed"],
    })
      .notNull()
      .default("pending"),
  },
  (table) => [
    // Ensure each provider event is only processed once (idempotency)
    uniqueIndex("billing_event_provider_event_id_idx").on(table.provider, table.providerEventId),
  ],
);

/**
 * Billing purchases table - tracks one-time payments (lifetime purchases)
 * Stores information about completed or attempted one-time payments
 */
export const billingPurchase = sqliteTable(
  "billing_purchase",
  {
    id: text("id").primaryKey(), // Internal purchase record ID
    userId: text("user_id").notNull(), // Internal user ID
    provider: text("provider", {
      enum: SUPPORTED_SERVER_PAYMENT_PROVIDERS,
    }).notNull(), // Payment provider that processed payment
    providerPaymentIntentId: text("provider_payment_intent_id").notNull(), // Payment intent ID in provider's system
    planId: text("plan_id").notNull(), // Plan that was purchased
    priceId: text("price_id").notNull(), // Price that was paid
    status: text("status", {
      enum: ["succeeded", "pending", "failed", "refunded"],
    }).notNull(), // Current status of the purchase
    paidAt: integer("paid_at", { mode: "timestamp" }), // When payment was completed (if succeeded)
    providerEventAt: integer("provider_event_at", { mode: "timestamp" }), // Latest provider event timestamp applied to this purchase
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    // Each provider payment intent ID should be unique per provider
    uniqueIndex("billing_purchase_provider_payment_intent_id_idx").on(
      table.provider,
      table.providerPaymentIntentId,
    ),
    index("billing_purchase_user_updated_idx").on(table.userId, table.updatedAt),
    index("billing_purchase_status_updated_idx").on(table.status, table.updatedAt),
  ],
);
