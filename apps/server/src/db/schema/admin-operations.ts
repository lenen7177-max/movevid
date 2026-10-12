import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const ADMIN_OPERATION_ACTIONS = ["credits.adjust", "membership.grant_trial"] as const;
export const ADMIN_OPERATION_STATUSES = ["pending", "succeeded", "failed"] as const;
export const ADMIN_TRIAL_TIERS = ["monthly", "yearly"] as const;

export type AdminOperationMetadata = Record<string, string | number | boolean | null>;

/** Records administrator mutations for support, testing, and audit review. */
export const adminOperation = sqliteTable(
  "admin_operation",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    targetEmail: text("target_email").notNull(),
    action: text("action", { enum: ADMIN_OPERATION_ACTIONS }).notNull(),
    status: text("status", { enum: ADMIN_OPERATION_STATUSES }).notNull().default("pending"),
    reason: text("reason"),
    metadata: text("metadata", { mode: "json" }).$type<AdminOperationMetadata>(),
    errorMessage: text("error_message"),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("admin_operation_target_created_idx").on(table.targetUserId, table.createdAt),
    index("admin_operation_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("admin_operation_status_created_idx").on(table.status, table.createdAt),
  ],
);

/** Stores time-bounded membership access granted outside payment providers. */
export const adminMembershipGrant = sqliteTable(
  "admin_membership_grant",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tier: text("tier", { enum: ADMIN_TRIAL_TIERS }).notNull(),
    startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("admin_membership_grant_user_expiry_idx").on(table.userId, table.expiresAt)],
);

export type AdminOperation = typeof adminOperation.$inferSelect;
export type AdminMembershipGrant = typeof adminMembershipGrant.$inferSelect;
