import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/** Identifier kinds an administrator can block. */
export const ABUSE_BLOCKLIST_KINDS = ["email_domain", "ip", "device"] as const;

/** Client surfaces that can report a device signal. */
export const CLIENT_SIGNAL_PLATFORMS = ["web", "native", "extension"] as const;

/** Administrator-managed identifiers that are rejected at signup or sign-in. */
export const abuseBlocklist = sqliteTable(
  "abuse_blocklist",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ABUSE_BLOCKLIST_KINDS }).notNull(),
    value: text("value").notNull(),
    reason: text("reason"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("abuse_blocklist_kind_value_idx").on(table.kind, table.value)],
);

/** Latest device and IP hash seen for an authenticated client. */
export const userClientSignal = sqliteTable(
  "user_client_signal",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: CLIENT_SIGNAL_PLATFORMS }).notNull(),
    deviceHash: text("device_hash").notNull(),
    ipHash: text("ip_hash"),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("user_client_signal_user_device_idx").on(table.userId, table.deviceHash),
    index("user_client_signal_user_seen_idx").on(table.userId, table.lastSeenAt),
  ],
);

export type AbuseBlocklistKind = (typeof ABUSE_BLOCKLIST_KINDS)[number];
export type ClientSignalPlatform = (typeof CLIENT_SIGNAL_PLATFORMS)[number];
export type AbuseBlocklistEntry = typeof abuseBlocklist.$inferSelect;
export type UserClientSignal = typeof userClientSignal.$inferSelect;
