import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * Where a user first came from (first touch), recorded once right after sign-up from what the
 * browser saw on its first visit. Orders are attributed to the channel of the user who placed them.
 */
export const userAcquisition = sqliteTable(
  "user_acquisition",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Normalized channel, e.g. chatgpt, google, x, tiktok, referral, direct (see analytics/acquisition). */
    channel: text("channel").notNull(),
    referrerHost: text("referrer_host"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    landingPath: text("landing_path"),
    /** When the browser first saw the site; null when it was not captured. */
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("user_acquisition_channel_idx").on(table.channel)],
);
