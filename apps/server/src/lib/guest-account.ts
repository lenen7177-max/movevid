import { and, eq, lt, notExists, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { user } from "@/db/schema/auth";
import { userAcquisition } from "@/db/schema/acquisition";
import {
  creditAccount,
  creditOrder,
  creditSignupGrantClaim,
  creditTransaction,
} from "@/db/schema/credits";
import {
  billingCheckoutSession,
  billingCustomer,
  billingPurchase,
  billingSubscription,
} from "@/db/schema/payments";
import { videoJob } from "@/db/schema/video";

/**
 * Guests order without signing in: the first Generate or Buy click signs the browser in as an
 * anonymous user (Better Auth anonymous plugin), whose placeholder email sits on a reserved,
 * undeliverable domain. Paying names the guest after the Stripe email (claimGuestAccount), and
 * signing in later moves everything the guest owns onto the real account (mergeGuestAccount).
 */
export const GUEST_EMAIL_DOMAIN = "guest.invalid";

/** Guests that never ordered are deleted after this long. */
const IDLE_GUEST_DAYS = 7;

export function buildGuestEmail(): string {
  return `guest-${crypto.randomUUID().replaceAll("-", "")}@${GUEST_EMAIL_DOMAIN}`;
}

export function isGuestEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`));
}

/** Whether a Better Auth session user is a guest; the plugin field isn't in the base user type. */
export function isGuestUser(sessionUser: object | null | undefined): boolean {
  return Boolean(sessionUser && "isAnonymous" in sessionUser && sessionUser.isAnonymous === true);
}

/**
 * Moves a guest's credits, orders, renders and billing records onto the account they signed in
 * to. Runs before the anonymous plugin deletes the guest, in one D1 batch.
 */
export async function mergeGuestAccount(db: Database, fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) return;
  const now = new Date();

  const [guestCredits] = await db
    .select()
    .from(creditAccount)
    .where(eq(creditAccount.userId, fromUserId))
    .limit(1);
  // One customer record per provider: the account keeps its own and the guest's is dropped.
  const ownProviders = new Set(
    (
      await db
        .select({ provider: billingCustomer.provider })
        .from(billingCustomer)
        .where(eq(billingCustomer.userId, toUserId))
    ).map((row) => row.provider),
  );
  const guestCustomers = await db
    .select({ id: billingCustomer.id, provider: billingCustomer.provider })
    .from(billingCustomer)
    .where(eq(billingCustomer.userId, fromUserId));
  const [ownAcquisition] = await db
    .select({ userId: userAcquisition.userId })
    .from(userAcquisition)
    .where(eq(userAcquisition.userId, toUserId))
    .limit(1);

  const move = { userId: toUserId, updatedAt: now };
  await db.batch([
    db.update(creditTransaction).set(move).where(eq(creditTransaction.userId, fromUserId)),
    db.update(creditOrder).set(move).where(eq(creditOrder.userId, fromUserId)),
    db
      .update(creditSignupGrantClaim)
      .set(move)
      .where(eq(creditSignupGrantClaim.userId, fromUserId)),
    db.update(videoJob).set(move).where(eq(videoJob.userId, fromUserId)),
    db
      .update(billingCheckoutSession)
      .set(move)
      .where(eq(billingCheckoutSession.userId, fromUserId)),
    db.update(billingPurchase).set(move).where(eq(billingPurchase.userId, fromUserId)),
    db.update(billingSubscription).set(move).where(eq(billingSubscription.userId, fromUserId)),
    ...guestCustomers.map((customer) =>
      ownProviders.has(customer.provider)
        ? db.delete(billingCustomer).where(eq(billingCustomer.id, customer.id))
        : db.update(billingCustomer).set(move).where(eq(billingCustomer.id, customer.id)),
    ),
    ...(ownAcquisition
      ? []
      : [
          db
            .update(userAcquisition)
            .set({ userId: toUserId })
            .where(eq(userAcquisition.userId, fromUserId)),
        ]),
    ...(guestCredits
      ? [
          db
            .insert(creditAccount)
            .values({ ...guestCredits, userId: toUserId, createdAt: now, updatedAt: now })
            .onConflictDoUpdate({
              target: creditAccount.userId,
              set: {
                balance: sql`${creditAccount.balance} + ${guestCredits.balance}`,
                totalGranted: sql`${creditAccount.totalGranted} + ${guestCredits.totalGranted}`,
                totalConsumed: sql`${creditAccount.totalConsumed} + ${guestCredits.totalConsumed}`,
                totalExpired: sql`${creditAccount.totalExpired} + ${guestCredits.totalExpired}`,
                totalRevoked: sql`${creditAccount.totalRevoked} + ${guestCredits.totalRevoked}`,
                updatedAt: now,
              },
            }),
          db.delete(creditAccount).where(eq(creditAccount.userId, fromUserId)),
        ]
      : []),
  ]);
}

/**
 * After a guest pays, names the guest after the email they gave Stripe so they can sign in with
 * it (email code) on any device. Skipped when that email already has an account: the guest keeps
 * the credits in this browser and merges them by signing in there.
 */
export async function claimGuestAccount(db: Database, userId: string, email: string | null) {
  const address = email?.trim().toLowerCase();
  if (!address || isGuestEmail(address)) return;

  const [guest] = await db
    .select({ isAnonymous: user.isAnonymous })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!guest?.isAnonymous) return;

  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, address))
    .limit(1);
  if (taken) return;

  try {
    await db
      .update(user)
      .set({
        email: address,
        // Not verified: the first email-code sign-in verifies it.
        emailVerified: false,
        name: address.split("@")[0] || address,
        isAnonymous: false,
        updatedAt: new Date(),
      })
      .where(and(eq(user.id, userId), eq(user.isAnonymous, true)));
  } catch (error) {
    // Another account took the email in the meantime; the guest stays a guest.
    console.warn("[guest] could not claim guest account", { userId, error });
  }
}

/** Deletes guests that never placed an order or started a render. */
export async function purgeIdleGuestAccounts(db: Database) {
  const cutoff = new Date(Date.now() - IDLE_GUEST_DAYS * 24 * 60 * 60 * 1000);
  await db
    .delete(user)
    .where(
      and(
        eq(user.isAnonymous, true),
        lt(user.createdAt, cutoff),
        notExists(
          db
            .select({ id: creditOrder.id })
            .from(creditOrder)
            .where(eq(creditOrder.userId, user.id)),
        ),
        notExists(
          db.select({ id: videoJob.id }).from(videoJob).where(eq(videoJob.userId, user.id)),
        ),
      ),
    );
}
