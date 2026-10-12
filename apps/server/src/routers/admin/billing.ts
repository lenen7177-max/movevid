import { ORPCError } from "@orpc/server";
import { resolveCommonConfig, SUPPORTED_SERVER_PAYMENT_PROVIDERS } from "@repo/app-config";
import {
  findMembershipPriceById,
  resolveCurrentMembershipEntitlement,
} from "@repo/app-config/membership";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@repo/app-config/payments/web";
import { getVisibleUserName } from "@repo/shared";
import { and, eq, exists, inArray, isNull, like, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db";
import { userAcquisition } from "@/db/schema/acquisition";
import { user } from "@/db/schema/auth";
import { creditOrder } from "@/db/schema/credits";
import { billingPurchase, billingSubscription } from "@/db/schema/payments";
import { adminMembershipGrant } from "@/db/schema/admin-operations";
import { adminProcedure } from "@/lib/orpc";
import { findBillingPriceForRecord } from "@/payments/domain/plan-catalog";

const paidUserStates = ["paid", "trial", "ended"] as const;
// "credits" marks buyers of credit packs; as a filter it also matches members who bought packs.
const paidMembershipTiers = ["monthly", "yearly", "lifetime", "credits"] as const;
const paidUserSortIds = ["name", "latestBillingAt"] as const;
const visiblePurchaseStatuses = ["succeeded", "refunded"] as const;
const visibleCreditOrderStatuses = ["completed", "refunded"] as const;

const paidUserStateSchema = z.enum(paidUserStates);
const paidMembershipTierSchema = z.enum(paidMembershipTiers);
const providerSchema = z.enum([...SUPPORTED_SERVER_PAYMENT_PROVIDERS, "admin"]);

const listPaidUsersInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  states: z.array(paidUserStateSchema).default([]),
  tiers: z.array(paidMembershipTierSchema).default([]),
  providers: z.array(providerSchema).default([]),
  sort: z
    .array(
      z.object({
        id: z.enum(paidUserSortIds),
        desc: z.boolean(),
      }),
    )
    .max(1)
    .default([{ id: "latestBillingAt", desc: true }]),
});

const listPriceSchema = z.object({
  // This is the current catalog price, not an invoice amount or recognized revenue.
  currency: z.string(),
  amountCents: z.number(),
  interval: z.enum(["month", "year"]).nullable(),
});

const paidUserSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phoneNumber: z.string().nullable(),
    image: z.string().nullable(),
    banned: z.boolean(),
  }),
  state: paidUserStateSchema,
  membershipTier: paidMembershipTierSchema.nullable(),
  source: z.enum(["subscription", "lifetime", "admin_trial", "credits"]),
  provider: providerSchema,
  planId: z.string(),
  priceId: z.string(),
  listPrice: listPriceSchema.nullable(),
  billingStatus: z.string(),
  startedOrPaidAt: z.date(),
  currentPeriodEnd: z.date().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  latestBillingAt: z.date(),
  /** Where the user first came from; null for users who signed up before it was recorded. */
  acquisition: z
    .object({
      channel: z.string(),
      referrerHost: z.string().nullable(),
      utmSource: z.string().nullable(),
      utmCampaign: z.string().nullable(),
      landingPath: z.string().nullable(),
    })
    .nullable(),
  /** Completed credit pack orders, for members and pack-only buyers alike. */
  creditPurchases: z
    .object({
      count: z.number(),
      credits: z.number(),
      amountCents: z.number(),
      currency: z.string(),
    })
    .nullable(),
});

const stateCountsSchema = z.object({
  paid: z.number(),
  trial: z.number(),
  ended: z.number(),
});

const listPaidUsersOutputSchema = z.object({
  data: z.array(paidUserSchema),
  total: z.number(),
  pageCount: z.number(),
  counts: stateCountsSchema,
});

type ListPaidUsersInput = z.infer<typeof listPaidUsersInputSchema>;
type PaidUser = z.infer<typeof paidUserSchema>;
/** A paid-user row before its acquisition source is attached. */
type PaidUserRow = Omit<PaidUser, "acquisition">;
type PaidUserState = z.infer<typeof paidUserStateSchema>;
type SubscriptionRecord = typeof billingSubscription.$inferSelect;
type PurchaseRecord = typeof billingPurchase.$inferSelect;
type AdminTrialRecord = typeof adminMembershipGrant.$inferSelect;
type CreditOrderRecord = typeof creditOrder.$inferSelect;

type BillingUser = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  image: string | null;
  banned: boolean | null;
};

type UserBillingRecords = {
  subscriptions: SubscriptionRecord[];
  purchases: PurchaseRecord[];
  adminTrials: AdminTrialRecord[];
  creditOrders: CreditOrderRecord[];
};

type SelectedBillingRecord =
  | { source: "subscription"; record: SubscriptionRecord }
  | { source: "lifetime"; record: PurchaseRecord }
  | { source: "admin_trial"; record: AdminTrialRecord };

const billingUserSelect = {
  id: user.id,
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber,
  image: user.image,
  banned: user.banned,
} as const;

/**
 * D1 limits the number of bound variables in one statement. Billing rows are therefore loaded in
 * bounded user-id batches instead of interpolating an unbounded IN list.
 */
function chunkUserIds(userIds: string[], size = 80): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < userIds.length; index += size) {
    chunks.push(userIds.slice(index, index + size));
  }
  return chunks;
}

/** Builds the real-user search predicate before any billing rows are loaded. */
function buildUserSearchCondition(search: string | undefined): SQL | undefined {
  const searchTerm = search?.trim();
  if (!searchTerm) return undefined;

  const pattern = `%${searchTerm}%`;
  return like(user.name, pattern);
}

/**
 * Loads real, non-deleted users that have membership payment history, a paid credit pack or an
 * administrator trial. Checkout attempts and billing-customer rows alone do not qualify.
 */
async function listBillingUsers(db: Database, search: string | undefined): Promise<BillingUser[]> {
  const hasSubscription = exists(
    db
      .select({ id: billingSubscription.id })
      .from(billingSubscription)
      .where(eq(billingSubscription.userId, user.id)),
  );
  const hasVisiblePurchase = exists(
    db
      .select({ id: billingPurchase.id })
      .from(billingPurchase)
      .where(
        and(
          eq(billingPurchase.userId, user.id),
          inArray(billingPurchase.status, visiblePurchaseStatuses),
        ),
      ),
  );
  const hasCreditOrder = exists(
    db
      .select({ id: creditOrder.id })
      .from(creditOrder)
      .where(
        and(
          eq(creditOrder.userId, user.id),
          inArray(creditOrder.status, visibleCreditOrderStatuses),
        ),
      ),
  );
  const hasAdminTrial = exists(
    db
      .select({ id: adminMembershipGrant.id })
      .from(adminMembershipGrant)
      .where(eq(adminMembershipGrant.userId, user.id)),
  );

  return db
    .select(billingUserSelect)
    .from(user)
    .where(
      and(
        isNull(user.deletedAt),
        or(hasSubscription, hasVisiblePurchase, hasCreditOrder, hasAdminTrial),
        buildUserSearchCondition(search),
      ),
    );
}

/** Loads billing records through ordinary Drizzle queries and groups them by real user id. */
async function loadBillingRecords(
  db: Database,
  billingUsers: BillingUser[],
): Promise<Map<string, UserBillingRecords>> {
  const recordsByUser = new Map<string, UserBillingRecords>(
    billingUsers.map((billingUser) => [
      billingUser.id,
      { subscriptions: [], purchases: [], adminTrials: [], creditOrders: [] },
    ]),
  );

  for (const userIds of chunkUserIds(billingUsers.map((billingUser) => billingUser.id))) {
    const [subscriptions, purchases, adminTrials, creditOrders] = await Promise.all([
      db.select().from(billingSubscription).where(inArray(billingSubscription.userId, userIds)),
      db
        .select()
        .from(billingPurchase)
        .where(
          and(
            inArray(billingPurchase.userId, userIds),
            inArray(billingPurchase.status, visiblePurchaseStatuses),
          ),
        ),
      db.select().from(adminMembershipGrant).where(inArray(adminMembershipGrant.userId, userIds)),
      db
        .select()
        .from(creditOrder)
        .where(
          and(
            inArray(creditOrder.userId, userIds),
            inArray(creditOrder.status, visibleCreditOrderStatuses),
          ),
        ),
    ]);

    for (const subscription of subscriptions) {
      recordsByUser.get(subscription.userId)!.subscriptions.push(subscription);
    }
    for (const purchase of purchases) {
      recordsByUser.get(purchase.userId)!.purchases.push(purchase);
    }
    for (const trial of adminTrials) {
      recordsByUser.get(trial.userId)!.adminTrials.push(trial);
    }
    for (const order of creditOrders) {
      recordsByUser.get(order.userId)!.creditOrders.push(order);
    }
  }

  return recordsByUser;
}

/** Account-level state precedence is independent from the record selected for membership display. */
function resolvePaidUserState(records: UserBillingRecords): PaidUserState {
  if (
    records.subscriptions.some((record) => record.status === "active") ||
    records.purchases.some((record) => record.status === "succeeded") ||
    records.creditOrders.some((record) => record.status === "completed")
  ) {
    return "paid";
  }
  const now = new Date();
  if (
    records.subscriptions.some((record) => record.status === "trialing") ||
    records.adminTrials.some((record) => record.startsAt <= now && record.expiresAt > now)
  ) {
    return "trial";
  }
  return "ended";
}

function recordUpdatedAt(record: SelectedBillingRecord): Date {
  return record.record.updatedAt;
}

function recordLatestBillingAt(record: SelectedBillingRecord): Date {
  return "providerEventAt" in record.record
    ? (record.record.providerEventAt ?? record.record.updatedAt)
    : record.record.updatedAt;
}

/**
 * Selects the same effective membership as the shared billing policy. If no entitlement currently
 * grants access, the newest subscription or refunded purchase is returned as operational history.
 */
function selectBillingRecord(records: UserBillingRecords): SelectedBillingRecord {
  const entitlement = resolveCurrentMembershipEntitlement({
    subscriptions: records.subscriptions,
    purchases: records.purchases,
    activeSubscriptionStatuses: ACTIVE_SUBSCRIPTION_STATUSES,
    findPriceById: findMembershipPriceById,
  });

  const candidates: SelectedBillingRecord[] =
    entitlement.source === "subscription"
      ? records.subscriptions
          .filter(
            (record) =>
              ACTIVE_SUBSCRIPTION_STATUSES.has(record.status) &&
              record.planId === entitlement.planId &&
              record.priceId === entitlement.priceId,
          )
          .map((record) => ({ source: "subscription" as const, record }))
      : entitlement.source === "lifetime"
        ? records.purchases
            .filter(
              (record) =>
                record.status === "succeeded" &&
                record.planId === entitlement.planId &&
                record.priceId === entitlement.priceId,
            )
            .map((record) => ({ source: "lifetime" as const, record }))
        : [];

  if (candidates.length > 0) {
    return candidates.reduce((current, next) =>
      recordUpdatedAt(next) > recordUpdatedAt(current) ? next : current,
    );
  }

  const activePaymentRecords: SelectedBillingRecord[] = [
    ...records.subscriptions
      .filter((record) => ACTIVE_SUBSCRIPTION_STATUSES.has(record.status))
      .map((record) => ({ source: "subscription" as const, record })),
    ...records.purchases
      .filter((record) => record.status === "succeeded")
      .map((record) => ({ source: "lifetime" as const, record })),
  ];
  if (activePaymentRecords.length > 0) {
    return activePaymentRecords.reduce((current, next) =>
      recordUpdatedAt(next) > recordUpdatedAt(current) ? next : current,
    );
  }

  const now = new Date();
  const activeAdminTrials = records.adminTrials
    .filter((record) => record.startsAt <= now && record.expiresAt > now)
    .map((record) => ({ source: "admin_trial" as const, record }));
  if (activeAdminTrials.length > 0) {
    return activeAdminTrials.reduce((current, next) =>
      recordUpdatedAt(next) > recordUpdatedAt(current) ? next : current,
    );
  }

  const history: SelectedBillingRecord[] = [
    ...records.subscriptions.map((record) => ({ source: "subscription" as const, record })),
    ...records.purchases.map((record) => ({ source: "lifetime" as const, record })),
    ...records.adminTrials.map((record) => ({ source: "admin_trial" as const, record })),
  ];
  return history.reduce((current, next) =>
    recordLatestBillingAt(next) > recordLatestBillingAt(current) ? next : current,
  );
}

/** Totals of a user's completed credit pack orders, in the currency of the latest one. */
function summarizeCreditPurchases(orders: CreditOrderRecord[]): PaidUser["creditPurchases"] {
  const completed = orders.filter((order) => order.status === "completed");
  if (completed.length === 0) return null;
  const latest = completed.reduce((current, next) =>
    next.updatedAt > current.updatedAt ? next : current,
  );
  const sameCurrency = completed.filter((order) => order.currency === latest.currency);
  return {
    count: completed.length,
    credits: completed.reduce((sum, order) => sum + order.creditAmount, 0),
    amountCents: sameCurrency.reduce((sum, order) => sum + order.amountCents, 0),
    currency: latest.currency,
  };
}

/** Row for a user whose only payments are credit packs: no membership, no renewal. */
function toCreditPackUser(billingUser: BillingUser, records: UserBillingRecords): PaidUserRow {
  const orders = records.creditOrders;
  const latest = orders.reduce((current, next) =>
    next.updatedAt > current.updatedAt ? next : current,
  );
  const first = orders.reduce((current, next) =>
    next.createdAt < current.createdAt ? next : current,
  );
  return {
    user: { ...billingUser, banned: Boolean(billingUser.banned) },
    state: resolvePaidUserState(records),
    membershipTier: "credits",
    source: "credits",
    provider: latest.provider,
    planId: latest.packageId,
    priceId: latest.packageId,
    listPrice: null,
    // Reuses the purchase labels: a completed pack reads as "succeeded".
    billingStatus: latest.status === "completed" ? "succeeded" : latest.status,
    startedOrPaidAt: first.createdAt,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    latestBillingAt: latest.updatedAt,
    creditPurchases: summarizeCreditPurchases(orders),
  };
}

/**
 * Converts one selected record to the public read-only shape. Catalog price is presentation data;
 * `null` is returned when an archived historical price no longer exists instead of inventing an
 * invoice amount that was never persisted locally.
 */
function toPaidUser(billingUser: BillingUser, records: UserBillingRecords): PaidUserRow {
  const hasMembershipHistory =
    records.subscriptions.length > 0 ||
    records.purchases.length > 0 ||
    records.adminTrials.length > 0;
  if (!hasMembershipHistory) return toCreditPackUser(billingUser, records);

  const creditPurchases = summarizeCreditPurchases(records.creditOrders);
  const selected = selectBillingRecord(records);
  if (selected.source === "admin_trial") {
    const selectedRecord = selected.record;
    const now = new Date();
    return {
      user: { ...billingUser, banned: Boolean(billingUser.banned) },
      state: resolvePaidUserState(records),
      membershipTier: selectedRecord.tier,
      source: "admin_trial",
      provider: "admin",
      planId: "admin-trial",
      priceId: `admin-trial:${selectedRecord.tier}`,
      listPrice: null,
      billingStatus: selectedRecord.expiresAt > now ? "active" : "expired",
      startedOrPaidAt: selectedRecord.startsAt,
      currentPeriodEnd: selectedRecord.expiresAt,
      cancelAtPeriodEnd: false,
      latestBillingAt: selectedRecord.updatedAt,
      creditPurchases,
    };
  }
  const selectedRecord = selected.record;
  const membershipPrice = findMembershipPriceById(selectedRecord.priceId);
  const catalogPrice = findBillingPriceForRecord(selectedRecord);
  const subscription = selected.source === "subscription" ? selected.record : null;
  const purchase = selected.source === "lifetime" ? selected.record : null;

  return {
    user: {
      ...billingUser,
      banned: Boolean(billingUser.banned),
    },
    state: resolvePaidUserState(records),
    membershipTier: membershipPrice?.tier ?? null,
    source: selected.source,
    provider: selectedRecord.provider,
    planId: selectedRecord.planId,
    priceId: selectedRecord.priceId,
    listPrice: catalogPrice
      ? {
          currency: catalogPrice.currency,
          amountCents: catalogPrice.amountCents,
          interval: catalogPrice.interval ?? null,
        }
      : null,
    billingStatus: selectedRecord.status,
    startedOrPaidAt: subscription?.startedAt ?? purchase?.paidAt ?? selectedRecord.createdAt,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    latestBillingAt: selectedRecord.providerEventAt ?? selectedRecord.updatedAt,
    creditPurchases,
  };
}

function matchesPresentationFilters(item: PaidUser, input: ListPaidUsersInput): boolean {
  return (
    (input.tiers.length === 0 ||
      (item.membershipTier !== null && input.tiers.includes(item.membershipTier)) ||
      (input.tiers.includes("credits") && item.creditPurchases !== null)) &&
    (input.providers.length === 0 || input.providers.includes(item.provider))
  );
}

function sortPaidUsers(items: PaidUser[], input: ListPaidUsersInput): void {
  const [sorting] = input.sort;
  const direction = sorting?.desc === false ? 1 : -1;

  items.sort((left, right) => {
    let comparison: number;
    if (sorting?.id === "name") {
      const leftName = getVisibleUserName(left.user) ?? left.user.name;
      const rightName = getVisibleUserName(right.user) ?? right.user.name;
      comparison = leftName.localeCompare(rightName);
    } else {
      comparison = left.latestBillingAt.getTime() - right.latestBillingAt.getTime();
    }
    return comparison === 0 ? left.user.id.localeCompare(right.user.id) : comparison * direction;
  });
}

function countPaidUserStates(items: PaidUser[]): z.infer<typeof stateCountsSchema> {
  const counts = { paid: 0, trial: 0, ended: 0 };
  for (const item of items) counts[item.state] += 1;
  return counts;
}

/** First-touch sources of the listed users, in the same D1-safe id batches as billing records. */
async function loadAcquisitions(
  db: Database,
  billingUsers: BillingUser[],
): Promise<Map<string, NonNullable<PaidUser["acquisition"]>>> {
  const byUser = new Map<string, NonNullable<PaidUser["acquisition"]>>();
  for (const userIds of chunkUserIds(billingUsers.map((item) => item.id))) {
    const rows = await db
      .select()
      .from(userAcquisition)
      .where(inArray(userAcquisition.userId, userIds));
    for (const row of rows) {
      byUser.set(row.userId, {
        channel: row.channel,
        referrerHost: row.referrerHost,
        utmSource: row.utmSource,
        utmCampaign: row.utmCampaign,
        landingPath: row.landingPath,
      });
    }
  }
  return byUser;
}

// Users who signed up before sources were recorded have no acquisition row.
const UNKNOWN_CHANNEL = "unknown";

const acquisitionSummarySchema = z.object({
  rows: z.array(
    z.object({
      channel: z.string(),
      signups: z.number(),
      creditBuyers: z.number(),
      creditOrders: z.number(),
      creditRevenueCents: z.number(),
      members: z.number(),
    }),
  ),
  currency: z.string().nullable(),
});

export const adminBillingRouter = {
  /**
   * Sign-ups, credit pack sales and members per first-touch channel (chatgpt, google, x…), so
   * revenue can be traced to where buyers came from.
   */
  acquisitionSummary: adminProcedure
    .output(acquisitionSummarySchema)
    .handler(async ({ context }) => {
      if (!resolveCommonConfig().admin.paidUsers.enabled) {
        throw new ORPCError("NOT_FOUND");
      }
      const channelOf = sql<string>`coalesce(${userAcquisition.channel}, ${UNKNOWN_CHANNEL})`;
      const [signups, credits, members] = await Promise.all([
        context.db
          .select({ channel: userAcquisition.channel, count: sql<number>`count(*)` })
          .from(userAcquisition)
          .groupBy(userAcquisition.channel),
        context.db
          .select({
            channel: channelOf,
            buyers: sql<number>`count(distinct ${creditOrder.userId})`,
            orders: sql<number>`count(*)`,
            revenueCents: sql<number>`coalesce(sum(${creditOrder.amountCents}), 0)`,
            currency: sql<string | null>`max(${creditOrder.currency})`,
          })
          .from(creditOrder)
          .leftJoin(userAcquisition, eq(userAcquisition.userId, creditOrder.userId))
          .where(eq(creditOrder.status, "completed"))
          .groupBy(channelOf),
        context.db
          .select({
            channel: channelOf,
            members: sql<number>`count(distinct ${billingSubscription.userId})`,
          })
          .from(billingSubscription)
          .leftJoin(userAcquisition, eq(userAcquisition.userId, billingSubscription.userId))
          .groupBy(channelOf),
      ]);

      const rows = new Map<string, z.infer<typeof acquisitionSummarySchema>["rows"][number]>();
      const row = (channel: string) => {
        const existing = rows.get(channel);
        if (existing) return existing;
        const created = {
          channel,
          signups: 0,
          creditBuyers: 0,
          creditOrders: 0,
          creditRevenueCents: 0,
          members: 0,
        };
        rows.set(channel, created);
        return created;
      };
      for (const item of signups) row(item.channel).signups = Number(item.count);
      for (const item of credits) {
        const target = row(item.channel);
        target.creditBuyers = Number(item.buyers);
        target.creditOrders = Number(item.orders);
        target.creditRevenueCents = Number(item.revenueCents);
      }
      for (const item of members) row(item.channel).members = Number(item.members);

      return {
        rows: [...rows.values()].sort(
          (a, b) => b.creditRevenueCents - a.creditRevenueCents || b.signups - a.signups,
        ),
        currency: credits.find((item) => item.currency)?.currency ?? null,
      };
    }),

  /**
   * Lists one operational membership row per real user. Payment records remain read-only here;
   * administrator trials are independent grants and never impersonate provider subscriptions.
   */
  listPaidUsers: adminProcedure
    .input(listPaidUsersInputSchema)
    .output(listPaidUsersOutputSchema)
    .handler(async ({ context, input }) => {
      // Keep the API gated as well as the navigation/route. Hiding a menu is not authorization.
      if (!resolveCommonConfig().admin.paidUsers.enabled) {
        throw new ORPCError("NOT_FOUND");
      }

      const billingUsers = await listBillingUsers(context.db, input.search);
      const recordsByUser = await loadBillingRecords(context.db, billingUsers);
      const acquisitionByUser = await loadAcquisitions(context.db, billingUsers);
      const paidUsers: PaidUser[] = billingUsers.map((billingUser) => ({
        ...toPaidUser(billingUser, recordsByUser.get(billingUser.id)!),
        acquisition: acquisitionByUser.get(billingUser.id) ?? null,
      }));

      const presentationFiltered = paidUsers.filter((item) =>
        matchesPresentationFilters(item, input),
      );
      const counts = countPaidUserStates(presentationFiltered);
      const stateFiltered =
        input.states.length === 0
          ? presentationFiltered
          : presentationFiltered.filter((item) => input.states.includes(item.state));

      sortPaidUsers(stateFiltered, input);
      const offset = (input.page - 1) * input.perPage;
      const total = stateFiltered.length;

      return {
        data: stateFiltered.slice(offset, offset + input.perPage),
        total,
        pageCount: Math.ceil(total / input.perPage),
        counts,
      };
    }),
};
