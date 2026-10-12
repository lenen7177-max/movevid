import { videoConfig } from "@repo/app-config/video";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Database } from "@/db";
import { creditTransaction } from "@/db/schema/credits";
import { expireCredits, grantCredits } from "./service";

const { monthlyAmount, rolloverCap } = videoConfig.subscriptionCredits;

/**
 * Index of the subscription month `now` falls in, counted from the day the subscription
 * started (month 0 is the first). Anchoring to the start day, not the calendar month, means a
 * subscriber who started on the 6th gets each grant on the 6th, once that month is paid for.
 */
export function subscriptionMonthIndex(startedAt: Date, now: Date): number {
  let months =
    (now.getUTCFullYear() - startedAt.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - startedAt.getUTCMonth());
  // Not yet past the anchor day/time this month: still in the previous subscription month.
  const anchor = new Date(startedAt);
  anchor.setUTCFullYear(now.getUTCFullYear(), now.getUTCMonth());
  if (anchor.getUTCMonth() !== now.getUTCMonth()) anchor.setUTCDate(0); // e.g. 31st → month end
  if (now < anchor) months -= 1;
  return Math.max(0, months);
}

/** Start of the active subscription, or null when the user has none. */
async function activeSubscriptionStart(db: Database, userId: string): Promise<Date | null> {
  // Lazy import: payments imports credits, so a static import would be circular.
  const { getPaymentService } = await import("@/payments");
  const status = await getPaymentService(db).getBillingStatus({ userId });
  if (status.currentEntitlement.source !== "subscription") return null;
  const subscription = status.subscription;
  return subscription?.startedAt ?? subscription?.createdAt ?? new Date(0);
}

async function remainingSubscriptionCredits(db: Database, userId: string, now: Date) {
  const rows = await db
    .select({ remainingAmount: creditTransaction.remainingAmount })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(creditTransaction.sourceType, "subscription_grant"),
        gt(creditTransaction.remainingAmount, 0),
        or(isNull(creditTransaction.expiresAt), gt(creditTransaction.expiresAt, now)),
      ),
    );
  return rows.reduce((sum, row) => sum + row.remainingAmount, 0);
}

async function grantMonthlyCredits(db: Database, userId: string, startedAt: Date, now: Date) {
  const remaining = await remainingSubscriptionCredits(db, userId, now);
  const amount = Math.min(monthlyAmount, Math.max(0, rolloverCap - remaining));
  if (amount <= 0) return;

  // One grant per subscription month; the source id makes retries idempotent.
  const period = subscriptionMonthIndex(startedAt, now);
  const anchor = startedAt.getTime();
  await grantCredits(db, {
    user: { userId },
    amount,
    sourceProvider: "system",
    sourceType: "subscription_grant",
    sourceId: `pro-monthly:${userId}:${anchor}:${period}`,
    expiresAt: null,
    metadata: { reason: "pro_monthly", period },
  });
}

async function forfeitSubscriptionCredits(db: Database, userId: string, now: Date) {
  const leftover = await remainingSubscriptionCredits(db, userId, now);
  if (leftover <= 0) return;

  await db
    .update(creditTransaction)
    .set({ expiresAt: new Date(now.getTime() - 1000), updatedAt: now })
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(creditTransaction.sourceType, "subscription_grant"),
        gt(creditTransaction.remainingAmount, 0),
      ),
    );
  await expireCredits(db, now);
}

/**
 * Grants the current subscription month's Pro credits (up to the rollover cap), or forfeits
 * leftover Pro credits once the subscription lapses. Monthly and yearly subscribers both get
 * videoConfig.subscriptionCredits.monthlyAmount per subscription month.
 */
export async function ensureMembershipCredits(db: Database, userId: string, now = new Date()) {
  const startedAt = await activeSubscriptionStart(db, userId);
  if (startedAt) {
    await grantMonthlyCredits(db, userId, startedAt, now);
    return;
  }
  await forfeitSubscriptionCredits(db, userId, now);
}
