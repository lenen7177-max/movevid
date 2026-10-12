import type { ServerPaymentProviderKey } from "@repo/app-config";
import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/** Internal ledger provider domains that are not payment-provider specific. */
export const CREDIT_INTERNAL_SOURCE_PROVIDERS = ["system", "app", "admin"] as const;

/** Supported transaction categories written into the credit ledger. */
export const CREDIT_SOURCE_TYPES = [
  "signup_grant",
  "purchase",
  "refund",
  "usage",
  "expiration",
  "adjustment",
  "subscription_grant",
] as const;

/** Payment lifecycle states for credit package orders. */
export const CREDIT_ORDER_STATUSES = [
  "pending",
  "completed",
  "failed",
  "expired",
  "refunded",
] as const;

/** Signup grant claim states used for eligibility and abuse checks. */
export const CREDIT_SIGNUP_GRANT_CLAIM_STATUSES = ["granted", "blocked"] as const;

/** Stores the current account-level balance and aggregate counters for quick reads. */
export const creditAccount = sqliteTable("credit_account", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  totalGranted: integer("total_granted").notNull().default(0),
  totalConsumed: integer("total_consumed").notNull().default(0),
  totalExpired: integer("total_expired").notNull().default(0),
  totalRevoked: integer("total_revoked").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/** Stores immutable credit ledger entries and remaining grant amounts. */
export const creditTransaction = sqliteTable(
  "credit_transaction",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Signed delta: positive for grants, negative for usage/refunds/expiration. */
    amount: integer("amount").notNull(),
    /** Remaining spendable amount for positive grant rows. */
    remainingAmount: integer("remaining_amount").notNull().default(0),
    /** Open text keeps the ledger extensible when a new payment provider is added. */
    sourceProvider: text("source_provider").notNull(),
    sourceType: text("source_type", { enum: CREDIT_SOURCE_TYPES }).notNull(),
    /** Provider event id, app idempotency key, or generated system source id. */
    sourceId: text("source_id").notNull(),
    packageId: text("package_id"),
    /** Null for paid credit packages, because purchased credits never expire. */
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    metadata: text("metadata", { mode: "json" }).$type<
      Record<string, string | number | boolean | null>
    >(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    /** Idempotency key shared by webhook grants, refunds, expirations, and app usage. */
    uniqueIndex("credit_transaction_source_idx").on(
      table.sourceProvider,
      table.sourceType,
      table.sourceId,
    ),
    index("credit_transaction_user_created_idx").on(table.userId, table.createdAt),
    index("credit_transaction_user_expiry_idx").on(table.userId, table.expiresAt),
    index("credit_transaction_expiry_idx").on(table.expiresAt, table.remainingAmount),
  ],
);

/** Tracks provider checkout state for credit package purchases. */
export const creditOrder = sqliteTable(
  "credit_order",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    packageId: text("package_id").notNull(),
    provider: text("provider").$type<ServerPaymentProviderKey>().notNull(),
    providerSessionId: text("provider_session_id"),
    providerPaymentId: text("provider_payment_id"),
    status: text("status", { enum: CREDIT_ORDER_STATUSES }).notNull().default("pending"),
    creditAmount: integer("credit_amount").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    ledgerTransactionId: text("ledger_transaction_id"),
    /** Template the buyer last worked with before checkout, for per-template conversion. */
    sourceTemplateId: text("source_template_id"),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("credit_order_provider_session_idx").on(table.provider, table.providerSessionId),
    index("credit_order_user_created_idx").on(table.userId, table.createdAt),
    index("credit_order_status_updated_idx").on(table.status, table.updatedAt),
  ],
);

/** Tracks signup grant eligibility decisions separate from immutable ledger rows. */
export const creditSignupGrantClaim = sqliteTable(
  "credit_signup_grant_claim",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    emailHash: text("email_hash").notNull(),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    deviceHash: text("device_hash"),
    grantedAmount: integer("granted_amount").notNull().default(0),
    status: text("status", { enum: CREDIT_SIGNUP_GRANT_CLAIM_STATUSES }).notNull(),
    reason: text("reason").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("credit_signup_grant_claim_user_status_idx").on(table.userId, table.status),
    index("credit_signup_grant_claim_email_status_idx").on(table.emailHash, table.status),
    index("credit_signup_grant_claim_ip_created_idx").on(
      table.ipHash,
      table.status,
      table.createdAt,
    ),
    index("credit_signup_grant_claim_user_agent_created_idx").on(
      table.userAgentHash,
      table.status,
      table.createdAt,
    ),
    index("credit_signup_grant_claim_device_created_idx").on(
      table.deviceHash,
      table.status,
      table.createdAt,
    ),
  ],
);

/** Selected credit account row type. */
export type CreditAccount = typeof creditAccount.$inferSelect;
/** Insertable credit account row type. */
export type NewCreditAccount = typeof creditAccount.$inferInsert;
/** Selected credit transaction row type. */
export type CreditTransaction = typeof creditTransaction.$inferSelect;
/** Insertable credit transaction row type. */
export type NewCreditTransaction = typeof creditTransaction.$inferInsert;
/** Selected credit order row type. */
export type CreditOrder = typeof creditOrder.$inferSelect;
/** Insertable credit order row type. */
export type NewCreditOrder = typeof creditOrder.$inferInsert;
/** Selected signup grant claim row type. */
export type CreditSignupGrantClaim = typeof creditSignupGrantClaim.$inferSelect;
/** Insertable signup grant claim row type. */
export type NewCreditSignupGrantClaim = typeof creditSignupGrantClaim.$inferInsert;
/** Internal non-payment provider source type. */
export type CreditInternalSourceProvider = (typeof CREDIT_INTERNAL_SOURCE_PROVIDERS)[number];
/** Ledger source provider type, including configured payment providers. */
export type CreditSourceProvider = CreditInternalSourceProvider | ServerPaymentProviderKey;
/** Ledger transaction source type. */
export type CreditSourceType = (typeof CREDIT_SOURCE_TYPES)[number];
/** Credit order payment lifecycle status. */
export type CreditOrderStatus = (typeof CREDIT_ORDER_STATUSES)[number];
/** Signup grant claim lifecycle status. */
export type CreditSignupGrantClaimStatus = (typeof CREDIT_SIGNUP_GRANT_CLAIM_STATUSES)[number];
