import {
  creditsConfig,
  findCreditPackageById,
  normalizeCreditsConfig,
  type NormalizedCreditPackage,
} from "@repo/app-config/credits";
import {
  resolveCommonConfig,
  type ServerPaymentProviderKey,
  type WebPaymentProviderKey,
} from "@repo/app-config";
import { canonicalizeEmailAddress, hashNamespacedValue, normalizeDeviceId } from "@repo/shared";
import { findAbuseBlock } from "@/abuse/policy";
import { and, asc, count, desc, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "@/db";
import { user as authUser } from "@/db/schema/auth";
import {
  creditAccount,
  creditOrder,
  creditSignupGrantClaim,
  creditTransaction,
  type CreditSourceProvider,
  type CreditSourceType,
} from "@/db/schema/credits";
import { findBillingCustomer } from "@/payments/infrastructure/repositories/billing-store";
import type { CheckoutSessionResult } from "@/payments/public/types";
import { toPublicCreditOrder } from "./orders";
import type {
  CreditBalance,
  CreditPackage,
  ListCreditOrdersOutput,
  ListCreditTransactionsOutput,
} from "../public/schemas";

/** Authenticated user identity required for account-level credit operations. */
type CreditUser = {
  /** Account user id that owns the credit balance. */
  userId: string;
};

type SignupGrantRequestContext = {
  hashSecret?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
};

type CreditServiceContext = {
  signupGrant?: SignupGrantRequestContext;
};

/** JSON metadata shape persisted with ledger transactions. */
type CreditMetadata = Record<string, string | number | boolean | null>;

/** Unique source tuple used to make ledger mutations idempotent. */
type CreditSource = {
  /** System domain or payment provider that produced the transaction. */
  sourceProvider: CreditSourceProvider;
  /** Semantic category of the source event. */
  sourceType: CreditSourceType;
  /** Provider event id, app idempotency key, or system-generated source id. */
  sourceId: string;
};

/** Input for creating a positive credit grant transaction. */
type GrantCreditsInput = CreditSource & {
  /** Account receiving the credit grant. */
  user: CreditUser;
  /** Positive credit amount to add. */
  amount: number;
  /** Optional package id when the grant comes from a purchasable package. */
  packageId?: string | null;
  /** Optional expiration timestamp; null means the grant is permanent. */
  expiresAt?: Date | null;
  /** Optional provider or app metadata stored with the ledger row. */
  metadata?: CreditMetadata | null;
};

/** Input for granting credits from a successful provider package purchase. */
type GrantCreditPackagePurchaseInput = {
  /** Account receiving purchased credits. */
  user: CreditUser;
  /** Internal configured credit package id. */
  packageId: string;
  /** Payment provider that emitted the successful purchase event. */
  sourceProvider: ServerPaymentProviderKey;
  /** Provider transaction id used for idempotency. */
  sourceId: string;
  /** Optional provider metadata stored with the purchase row. */
  metadata?: CreditMetadata | null;
};

/** Input for revoking the remaining credits from one known purchase transaction. */
type RevokeCreditPurchaseInput = {
  /** Account that owns the original purchase. */
  user: CreditUser;
  /** Provider that emitted the original purchase event. */
  originalSourceProvider: ServerPaymentProviderKey;
  /** Original purchase transaction id. */
  originalSourceId: string;
  /** Refund or cancellation event id used for idempotency. */
  refundSourceId: string;
  /** Optional provider metadata stored with the refund row. */
  metadata?: CreditMetadata | null;
};

/** Input for revoking a purchase when only the original provider source is known. */
type RevokeCreditPurchaseBySourceInput = {
  /** Provider that emitted the original purchase event. */
  originalSourceProvider: ServerPaymentProviderKey;
  /** Original purchase transaction id. */
  originalSourceId: string;
  /** Refund or cancellation event id used for idempotency. */
  refundSourceId: string;
  /** Optional provider metadata stored with the refund row. */
  metadata?: CreditMetadata | null;
};

/** Input for consuming credits from the current account balance. */
type ConsumeCreditsInput = {
  /** Account spending credits. */
  user: CreditUser;
  /** Positive amount to consume. */
  amount: number;
  /** Caller-provided idempotency key for the usage event. */
  idempotencyKey: string;
  /** Optional app metadata stored with the usage row. */
  metadata?: CreditMetadata | null;
};

type AdjustCreditsInput = {
  user: CreditUser;
  amount: number;
  idempotencyKey: string;
  metadata?: CreditMetadata | null;
};

/** Input for listing a user's ledger transactions. */
type ListTransactionsInput = {
  /** Account whose transactions should be listed. */
  user: CreditUser;
  /** 1-based page number. */
  page: number;
  /** Number of transactions per page. */
  perPage: number;
  /** Optional transaction category filter. */
  sourceType?: CreditSourceType;
};

/** Input for listing recent credit package purchase orders. */
type ListCreditOrdersInput = {
  /** Account whose purchase orders should be listed. */
  user: CreditUser;
  /** 1-based page number. */
  page: number;
  /** Number of orders per page. */
  perPage: number;
};

/** Input for listing purchasable packages for one client platform. */
type ListPackagesInput = {
  /** Client platform used to filter package availability. */
  platform: "web" | "ios" | "android";
};

/** Input for creating a web checkout session for a credit package. */
type CreateCreditCheckoutSessionInput = {
  /** Account buying credits. */
  user: CreditUser;
  /** Internal configured credit package id. */
  packageId: string;
  /** Redirect URL used after leaving provider checkout. */
  returnUrl: string;
  /** Optional expected provider, used to reject package/provider mismatches. */
  provider?: WebPaymentProviderKey;
  /** Optional email passed to checkout when no provider customer exists. */
  customerEmail?: string | null;
  /** Template the buyer came from, stored on the order for conversion reporting. */
  templateId?: string;
};

/** Input for completing a credit order after provider payment confirmation. */
type CompleteCreditOrderPurchaseInput = {
  /** Internal credit order id stored in provider metadata. */
  orderId: string;
  /** Payment provider that emitted the successful event. */
  sourceProvider: ServerPaymentProviderKey;
  /** Provider transaction id used for ledger idempotency. */
  sourceId: string;
  /** Optional checkout session id from the provider event. */
  providerSessionId?: string | null;
  /** Optional provider payment id for later refund correlation. */
  providerPaymentId?: string | null;
  /** Optional provider metadata stored with the purchase row. */
  metadata?: CreditMetadata | null;
};

/** Input for moving an unpaid order into a terminal non-crediting state. */
type MarkCreditOrderStatusInput = {
  /** Internal credit order id stored in provider metadata. */
  orderId: string;
  /** Terminal status to apply when the order is still pending. */
  status: "failed" | "expired";
  /** Optional provider payment id for audit and correlation. */
  providerPaymentId?: string | null;
};

/** Input for marking a completed credit order as refunded. */
type MarkCreditOrderRefundedInput = {
  /** Payment provider that emitted the refund event. */
  sourceProvider: ServerPaymentProviderKey;
  /** Provider transaction id for the original purchase. */
  providerPaymentId: string;
};

/** Window used to surface a warning for free credits that will expire soon. */
const EXPIRING_WINDOW_DAYS = 7;
const PENDING_ORDER_EXPIRATION_HOURS = 24;

type CreditBatchItem = BatchItem<"sqlite">;

/** Reads and normalizes the latest credit config for each service call. */
function getConfig() {
  return normalizeCreditsConfig(creditsConfig);
}

/** Throws when credit operations are disabled by configuration. */
function assertCreditsEnabled() {
  if (!getConfig().enabled) {
    throw new Error("Credits are disabled");
  }
}

/** Throws when a runtime credit amount is not a positive integer. */
function assertPositiveAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer");
  }
}

/** Returns a new date shifted by the requested number of UTC days. */
function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function subtractHours(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

/** Resolves an optional grant expiration timestamp from a configured day window. */
function resolveGrantExpiresAt(expiresInDays: number | null, now: Date) {
  return expiresInDays === null ? null : addDays(now, expiresInDays);
}

/** Converts an internal package config into the public package payload for one platform. */
function toPublicPackage(
  creditPackage: NormalizedCreditPackage,
  platform: ListPackagesInput["platform"],
): CreditPackage | null {
  if (creditPackage.status !== "active") {
    return null;
  }

  if (platform === "web") {
    if (!creditPackage.web || creditPackage.web.status !== "active") {
      return null;
    }

    return {
      id: creditPackage.id,
      amount: creditPackage.amount,
      platform,
      provider: creditPackage.web.provider,
      providerProductId: null,
      currency: creditPackage.web.currency,
      amountCents: creditPackage.web.amountCents,
    };
  }

  return null;
}

function createEmptyAccountInsert(db: Database, userId: string, now: Date) {
  return db
    .insert(creditAccount)
    .values({
      userId,
      balance: 0,
      totalGranted: 0,
      totalConsumed: 0,
      totalExpired: 0,
      totalRevoked: 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
}

/** Creates an empty credit account row when the user has no ledger yet. */
async function ensureCreditAccount(db: Database, userId: string) {
  await createEmptyAccountInsert(db, userId, new Date());
}

/** Finds an existing ledger transaction by its idempotency source tuple. */
async function findTransactionBySource(db: Database, source: CreditSource) {
  // The source tuple is the ledger idempotency key across all credit mutations.
  const [existing] = await db
    .select()
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.sourceProvider, source.sourceProvider),
        eq(creditTransaction.sourceType, source.sourceType),
        eq(creditTransaction.sourceId, source.sourceId),
      ),
    )
    .limit(1);

  return existing ?? null;
}

function createAccountGrantUpdate(db: Database, userId: string, amount: number, now: Date) {
  return db
    .insert(creditAccount)
    .values({
      userId,
      balance: amount,
      totalGranted: amount,
      totalConsumed: 0,
      totalExpired: 0,
      totalRevoked: 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: creditAccount.userId,
      set: {
        balance: sql`${creditAccount.balance} + ${amount}`,
        totalGranted: sql`${creditAccount.totalGranted} + ${amount}`,
        updatedAt: now,
      },
    });
}

function createAccountDebitUpdate(
  db: Database,
  input: {
    userId: string;
    amount: number;
    field: "totalConsumed" | "totalExpired" | "totalRevoked";
    now: Date;
    requireAvailableBalance?: boolean;
  },
) {
  return db
    .update(creditAccount)
    .set({
      balance: sql`${creditAccount.balance} - ${input.amount}`,
      [input.field]: sql`${creditAccount[input.field]} + ${input.amount}`,
      updatedAt: input.now,
    })
    .where(
      input.requireAvailableBalance
        ? and(eq(creditAccount.userId, input.userId), gte(creditAccount.balance, input.amount))
        : eq(creditAccount.userId, input.userId),
    );
}

function createBatchChangeGuard(db: Database, source: CreditSource) {
  return db.insert(creditTransaction).select((qb) =>
    qb
      .select({
        id: creditTransaction.id,
        userId: creditTransaction.userId,
        amount: creditTransaction.amount,
        remainingAmount: creditTransaction.remainingAmount,
        sourceProvider: creditTransaction.sourceProvider,
        sourceType: creditTransaction.sourceType,
        sourceId: creditTransaction.sourceId,
        packageId: creditTransaction.packageId,
        expiresAt: creditTransaction.expiresAt,
        metadata: creditTransaction.metadata,
        createdAt: creditTransaction.createdAt,
        updatedAt: creditTransaction.updatedAt,
      })
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.sourceProvider, source.sourceProvider),
          eq(creditTransaction.sourceType, source.sourceType),
          eq(creditTransaction.sourceId, source.sourceId),
          sql`changes() <> 1`,
        ),
      ),
  );
}

async function runCreditBatch(db: Database, batch: CreditBatchItem[]) {
  await db.batch(batch as [CreditBatchItem, ...CreditBatchItem[]]);
}

async function countGrantedSignupClaimsByEmail(db: Database, emailHash: string) {
  const [row] = await db
    .select({ count: count() })
    .from(creditSignupGrantClaim)
    .where(
      and(
        eq(creditSignupGrantClaim.emailHash, emailHash),
        eq(creditSignupGrantClaim.status, "granted"),
      ),
    );

  return row?.count ?? 0;
}

async function countGrantedSignupClaimsByIp(db: Database, ipHash: string, since: Date) {
  const [row] = await db
    .select({ count: count() })
    .from(creditSignupGrantClaim)
    .where(
      and(
        eq(creditSignupGrantClaim.ipHash, ipHash),
        eq(creditSignupGrantClaim.status, "granted"),
        gte(creditSignupGrantClaim.createdAt, since),
      ),
    );

  return row?.count ?? 0;
}

async function countGrantedSignupClaimsByDevice(db: Database, deviceHash: string) {
  const [row] = await db
    .select({ count: count() })
    .from(creditSignupGrantClaim)
    .where(
      and(
        eq(creditSignupGrantClaim.deviceHash, deviceHash),
        eq(creditSignupGrantClaim.status, "granted"),
      ),
    );

  return row?.count ?? 0;
}

async function recordBlockedSignupGrantClaim(
  db: Database,
  input: {
    userId: string;
    emailHash: string;
    ipHash: string | null;
    userAgentHash: string | null;
    deviceHash: string | null;
    reason: string;
    now: Date;
  },
) {
  const [existing] = await db
    .select({ id: creditSignupGrantClaim.id })
    .from(creditSignupGrantClaim)
    .where(
      and(
        eq(creditSignupGrantClaim.userId, input.userId),
        eq(creditSignupGrantClaim.status, "blocked"),
        eq(creditSignupGrantClaim.reason, input.reason),
      ),
    )
    .limit(1);
  if (existing) {
    return;
  }

  await db.insert(creditSignupGrantClaim).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    emailHash: input.emailHash,
    ipHash: input.ipHash,
    userAgentHash: input.userAgentHash,
    deviceHash: input.deviceHash,
    grantedAmount: 0,
    status: "blocked",
    reason: input.reason,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

async function grantSignupCredits(
  db: Database,
  input: GrantCreditsInput & {
    emailHash: string;
    ipHash: string | null;
    userAgentHash: string | null;
    deviceHash: string | null;
    now: Date;
  },
) {
  try {
    await runCreditBatch(db, [
      db.insert(creditTransaction).values({
        id: crypto.randomUUID(),
        userId: input.user.userId,
        amount: input.amount,
        remainingAmount: input.amount,
        sourceProvider: input.sourceProvider,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        packageId: input.packageId ?? null,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata ?? null,
        createdAt: input.now,
        updatedAt: input.now,
      }),
      createAccountGrantUpdate(db, input.user.userId, input.amount, input.now),
      db.insert(creditSignupGrantClaim).values({
        id: crypto.randomUUID(),
        userId: input.user.userId,
        emailHash: input.emailHash,
        ipHash: input.ipHash,
        userAgentHash: input.userAgentHash,
        deviceHash: input.deviceHash,
        grantedAmount: input.amount,
        status: "granted",
        reason: "eligible",
        createdAt: input.now,
        updatedAt: input.now,
      }),
    ]);
  } catch (error) {
    const existing = await findTransactionBySource(db, input);
    if (existing) {
      return existing;
    }
    throw error;
  }

  return findTransactionBySource(db, input);
}

/** Lazily grants configured signup credits exactly once per user. */
async function ensureSignupGrant(
  db: Database,
  user: CreditUser,
  serviceContext: CreditServiceContext = {},
) {
  const config = getConfig();
  const grant = config.signupGrant;
  if (!config.enabled || !grant?.enabled) {
    await ensureCreditAccount(db, user.userId);
    return;
  }

  const now = new Date();
  const grantSource = {
    sourceProvider: "system",
    sourceType: "signup_grant",
    sourceId: user.userId,
  } satisfies CreditSource;
  if (await findTransactionBySource(db, grantSource)) {
    return;
  }

  const [currentUser] = await db
    .select({
      email: authUser.email,
      emailVerified: authUser.emailVerified,
      phoneNumber: authUser.phoneNumber,
      phoneNumberVerified: authUser.phoneNumberVerified,
    })
    .from(authUser)
    .where(eq(authUser.id, user.userId))
    .limit(1);
  const verifiedIdentity = currentUser?.emailVerified
    ? { namespace: "email", value: currentUser.email }
    : currentUser?.phoneNumberVerified && currentUser.phoneNumber
      ? { namespace: "phone", value: currentUser.phoneNumber }
      : null;
  if (!verifiedIdentity) {
    await ensureCreditAccount(db, user.userId);
    return;
  }

  const requestContext = serviceContext.signupGrant;
  const antiAbuse = grant.antiAbuse;
  const identityValue =
    verifiedIdentity.namespace === "email" && antiAbuse.enabled && antiAbuse.canonicalizeEmail
      ? canonicalizeEmailAddress(verifiedIdentity.value)
      : verifiedIdentity.value;
  const emailHash = await hashNamespacedValue(
    identityValue,
    verifiedIdentity.namespace,
    requestContext?.hashSecret,
  );
  if (!emailHash) {
    await ensureCreditAccount(db, user.userId);
    return;
  }

  const ipHash = await hashNamespacedValue(
    requestContext?.ipAddress,
    "ip",
    requestContext?.hashSecret,
  );
  const userAgentHash = await hashNamespacedValue(
    requestContext?.userAgent,
    "user-agent",
    requestContext?.hashSecret,
  );
  const deviceId = normalizeDeviceId(requestContext?.deviceId);
  const deviceHash = await hashNamespacedValue(deviceId, "device", requestContext?.hashSecret);
  const claimContext = {
    userId: user.userId,
    emailHash,
    ipHash,
    userAgentHash,
    deviceHash,
    now,
  };

  if ((await countGrantedSignupClaimsByEmail(db, emailHash)) > 0) {
    await ensureCreditAccount(db, user.userId);
    await recordBlockedSignupGrantClaim(db, {
      ...claimContext,
      reason: "identity_already_granted",
    });
    return;
  }

  const blockedKind = await findAbuseBlock(db, {
    email: verifiedIdentity.namespace === "email" ? verifiedIdentity.value : null,
    ipAddress: requestContext?.ipAddress,
    deviceId,
    hashSecret: requestContext?.hashSecret,
    includeDisposableEmailDomains: resolveCommonConfig().auth.abuse.blockDisposableEmailDomains,
    kinds: ["email_domain", "ip", "device"],
  });
  if (blockedKind) {
    await ensureCreditAccount(db, user.userId);
    await recordBlockedSignupGrantClaim(db, {
      ...claimContext,
      reason: "blocklisted",
    });
    return;
  }

  if (
    antiAbuse.enabled &&
    deviceHash &&
    (await countGrantedSignupClaimsByDevice(db, deviceHash)) >= antiAbuse.device.maxGrants
  ) {
    await ensureCreditAccount(db, user.userId);
    await recordBlockedSignupGrantClaim(db, {
      ...claimContext,
      reason: "device_already_granted",
    });
    return;
  }

  if (
    antiAbuse.enabled &&
    ipHash &&
    (await countGrantedSignupClaimsByIp(
      db,
      ipHash,
      subtractHours(now, antiAbuse.ip.windowHours),
    )) >= antiAbuse.ip.maxGrants
  ) {
    await ensureCreditAccount(db, user.userId);
    await recordBlockedSignupGrantClaim(db, {
      ...claimContext,
      reason: "ip_limit",
    });
    return;
  }

  await grantSignupCredits(db, {
    user,
    amount: grant.amount,
    ...grantSource,
    expiresAt: resolveGrantExpiresAt(grant.expiresInDays, now),
    metadata: { reason: "signup" },
    emailHash,
    ipHash,
    userAgentHash,
    deviceHash,
    now,
  });
}

/** Removes unspent signup-grant credits and leaves purchased credits in place. */
export async function revokeRemainingSignupCredits(
  db: Database,
  input: { userId: string; idempotencyKey: string },
): Promise<{ revokedAmount: number }> {
  const config = getConfig();
  if (!config.enabled) return { revokedAmount: 0 };

  const source = {
    sourceProvider: "admin",
    sourceType: "adjustment",
    sourceId: input.idempotencyKey,
  } satisfies CreditSource;
  const existing = await findTransactionBySource(db, source);
  if (existing) return { revokedAmount: Math.abs(existing.amount) };

  const grants = await db
    .select({
      id: creditTransaction.id,
      remainingAmount: creditTransaction.remainingAmount,
    })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, input.userId),
        eq(creditTransaction.sourceProvider, "system"),
        eq(creditTransaction.sourceType, "signup_grant"),
        gt(creditTransaction.remainingAmount, 0),
      ),
    );
  const remaining = grants.reduce((sum, row) => sum + row.remainingAmount, 0);
  if (remaining === 0) return { revokedAmount: 0 };

  await ensureCreditAccount(db, input.userId);
  const [account] = await db
    .select({ balance: creditAccount.balance })
    .from(creditAccount)
    .where(eq(creditAccount.userId, input.userId));
  const debit = Math.min(account?.balance ?? 0, remaining);
  const now = new Date();
  const batch: CreditBatchItem[] = [];

  if (debit > 0) {
    batch.push(
      db.insert(creditTransaction).values({
        id: crypto.randomUUID(),
        userId: input.userId,
        amount: -debit,
        remainingAmount: 0,
        ...source,
        packageId: null,
        expiresAt: null,
        metadata: { reason: "signup_grant_revoke" },
        createdAt: now,
        updatedAt: now,
      }),
      createAccountDebitUpdate(db, {
        userId: input.userId,
        amount: debit,
        field: "totalRevoked",
        now,
        requireAvailableBalance: true,
      }),
      createBatchChangeGuard(db, source),
    );
  }

  for (const grant of grants) {
    batch.push(
      db
        .update(creditTransaction)
        .set({ remainingAmount: 0, updatedAt: now })
        .where(and(eq(creditTransaction.id, grant.id), gt(creditTransaction.remainingAmount, 0))),
    );
  }

  await runCreditBatch(db, batch);
  return { revokedAmount: debit };
}

/** Builds the credit domain service bound to one database instance. */
export function createCreditsService(db: Database, serviceContext: CreditServiceContext = {}) {
  return {
    listPackages: (input: ListPackagesInput) => listPackages(input),
    getBalance: (user: CreditUser) => getBalance(db, user, serviceContext),
    listTransactions: (input: ListTransactionsInput) => listTransactions(db, input, serviceContext),
    listOrders: (input: ListCreditOrdersInput) => listCreditOrders(db, input),
    consumeCredits: (input: ConsumeCreditsInput) => consumeCredits(db, input, serviceContext),
    createCheckoutSession: (input: CreateCreditCheckoutSessionInput) =>
      createCreditCheckoutSession(db, input),
    runMaintenance: (now?: Date) => runCreditMaintenance(db, now),
  };
}

/** Lists active credit packages available on the requested platform. */
export function listPackages(input: ListPackagesInput): CreditPackage[] {
  const config = getConfig();
  if (!config.enabled) {
    return [];
  }

  return config.packages
    .map((creditPackage) => toPublicPackage(creditPackage, input.platform))
    .filter((item): item is CreditPackage => item !== null);
}

/** Returns current balance, aggregate counters, and soon-to-expire free credits. */
export async function getBalance(
  db: Database,
  input: CreditUser,
  serviceContext: CreditServiceContext = {},
): Promise<CreditBalance> {
  assertCreditsEnabled();
  await ensureSignupGrant(db, input, serviceContext);

  const [account] = await db
    .select()
    .from(creditAccount)
    .where(eq(creditAccount.userId, input.userId))
    .limit(1);

  const now = new Date();
  const expiringBefore = addDays(now, EXPIRING_WINDOW_DAYS);
  const expiringRows = await db
    .select({ remainingAmount: creditTransaction.remainingAmount })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, input.userId),
        gt(creditTransaction.remainingAmount, 0),
        gt(creditTransaction.expiresAt, now),
        lte(creditTransaction.expiresAt, expiringBefore),
      ),
    );
  const expiringCredits = expiringRows.reduce((sum, row) => sum + row.remainingAmount, 0);

  return {
    userId: input.userId,
    balance: account?.balance ?? 0,
    totalGranted: account?.totalGranted ?? 0,
    totalConsumed: account?.totalConsumed ?? 0,
    totalExpired: account?.totalExpired ?? 0,
    totalRevoked: account?.totalRevoked ?? 0,
    expiringCredits,
  };
}

/** Returns a paginated list of account ledger transactions. */
export async function listTransactions(
  db: Database,
  input: ListTransactionsInput,
  serviceContext: CreditServiceContext = {},
): Promise<ListCreditTransactionsOutput> {
  assertCreditsEnabled();
  await ensureSignupGrant(db, input.user, serviceContext);

  const offset = (input.page - 1) * input.perPage;
  const filter = input.sourceType
    ? and(
        eq(creditTransaction.userId, input.user.userId),
        eq(creditTransaction.sourceType, input.sourceType),
      )
    : eq(creditTransaction.userId, input.user.userId);
  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(creditTransaction)
      .where(filter)
      .orderBy(desc(creditTransaction.createdAt))
      .limit(input.perPage)
      .offset(offset),
    db.select({ count: count() }).from(creditTransaction).where(filter),
  ]);
  const total = totalRows.at(0)?.count ?? 0;

  return {
    data: items.map((item) => ({
      id: item.id,
      amount: item.amount,
      remainingAmount: item.remainingAmount,
      sourceProvider: item.sourceProvider,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      packageId: item.packageId,
      expiresAt: item.expiresAt,
      metadata: item.metadata ?? null,
      createdAt: item.createdAt,
    })),
    pageCount: Math.ceil(total / input.perPage),
    total,
  };
}

/** Returns recent credit package purchase orders for the current account. */
export async function listCreditOrders(
  db: Database,
  input: ListCreditOrdersInput,
): Promise<ListCreditOrdersOutput> {
  assertCreditsEnabled();

  const offset = (input.page - 1) * input.perPage;
  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(creditOrder)
      .where(eq(creditOrder.userId, input.user.userId))
      .orderBy(desc(creditOrder.createdAt))
      .limit(input.perPage)
      .offset(offset),
    db
      .select({ count: count() })
      .from(creditOrder)
      .where(eq(creditOrder.userId, input.user.userId)),
  ]);
  const total = totalRows.at(0)?.count ?? 0;

  return {
    data: rows.map(toPublicCreditOrder),
    pageCount: Math.ceil(total / input.perPage),
    total,
  };
}

/** Creates an idempotent positive grant transaction and updates account balance. */
export async function grantCredits(db: Database, input: GrantCreditsInput) {
  assertCreditsEnabled();
  assertPositiveAmount(input.amount);

  const now = new Date();
  try {
    await runCreditBatch(db, [
      db.insert(creditTransaction).values({
        id: crypto.randomUUID(),
        userId: input.user.userId,
        amount: input.amount,
        remainingAmount: input.amount,
        sourceProvider: input.sourceProvider,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        packageId: input.packageId ?? null,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      }),
      createAccountGrantUpdate(db, input.user.userId, input.amount, now),
    ]);
  } catch (error) {
    const existing = await findTransactionBySource(db, input);
    if (existing) {
      return existing;
    }
    throw error;
  }

  return findTransactionBySource(db, input);
}

/** Applies an idempotent administrator adjustment without triggering signup grants. */
export async function adjustCredits(db: Database, input: AdjustCreditsInput) {
  assertCreditsEnabled();
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new Error("Credit adjustment must be a non-zero integer");
  }

  const adjustmentSource = {
    sourceProvider: "admin",
    sourceType: "adjustment",
    sourceId: input.idempotencyKey,
  } satisfies CreditSource;
  const existing = await findTransactionBySource(db, adjustmentSource);
  if (existing) {
    const [account] = await db
      .select()
      .from(creditAccount)
      .where(eq(creditAccount.userId, input.user.userId));
    return { transaction: existing, balance: account?.balance ?? 0 };
  }

  await ensureCreditAccount(db, input.user.userId);
  if (input.amount > 0) {
    const transaction = await grantCredits(db, {
      user: input.user,
      amount: input.amount,
      ...adjustmentSource,
      metadata: input.metadata ?? null,
    });
    const [account] = await db
      .select({ balance: creditAccount.balance })
      .from(creditAccount)
      .where(eq(creditAccount.userId, input.user.userId));
    return { transaction: transaction!, balance: account!.balance };
  }

  const debitAmount = Math.abs(input.amount);
  const now = new Date();
  const grantRows = await db
    .select()
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, input.user.userId),
        gt(creditTransaction.remainingAmount, 0),
        or(isNull(creditTransaction.expiresAt), gt(creditTransaction.expiresAt, now)),
      ),
    )
    .orderBy(asc(creditTransaction.createdAt));
  const grants = grantRows.sort((a, b) => {
    const aExpiry = a.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bExpiry = b.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
    return aExpiry - bExpiry || a.createdAt.getTime() - b.createdAt.getTime();
  });
  const available = grants.reduce((sum, item) => sum + item.remainingAmount, 0);
  if (available < debitAmount) {
    throw new Error("Insufficient credits");
  }

  let remaining = debitAmount;
  const batch: CreditBatchItem[] = [
    db.insert(creditTransaction).values({
      id: crypto.randomUUID(),
      userId: input.user.userId,
      amount: input.amount,
      remainingAmount: 0,
      ...adjustmentSource,
      packageId: null,
      expiresAt: null,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    }),
    createAccountDebitUpdate(db, {
      userId: input.user.userId,
      amount: debitAmount,
      field: "totalRevoked",
      now,
      requireAvailableBalance: true,
    }),
    createBatchChangeGuard(db, adjustmentSource),
  ];

  for (const grant of grants) {
    if (remaining === 0) break;
    const deducted = Math.min(grant.remainingAmount, remaining);
    remaining -= deducted;
    batch.push(
      db
        .update(creditTransaction)
        .set({
          remainingAmount: sql`${creditTransaction.remainingAmount} - ${deducted}`,
          updatedAt: now,
        })
        .where(
          and(eq(creditTransaction.id, grant.id), gte(creditTransaction.remainingAmount, deducted)),
        ),
      createBatchChangeGuard(db, adjustmentSource),
    );
  }

  await runCreditBatch(db, batch);
  const [transaction] = await db
    .select()
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.sourceProvider, "admin"),
        eq(creditTransaction.sourceType, "adjustment"),
        eq(creditTransaction.sourceId, input.idempotencyKey),
      ),
    );
  const [account] = await db
    .select({ balance: creditAccount.balance })
    .from(creditAccount)
    .where(eq(creditAccount.userId, input.user.userId));
  return { transaction: transaction!, balance: account!.balance };
}

/** Grants all credits from a configured purchased package in one permanent transaction. */
export async function grantCreditPackagePurchase(
  db: Database,
  input: GrantCreditPackagePurchaseInput,
) {
  const creditPackage = findCreditPackageById(creditsConfig, input.packageId);
  if (!creditPackage || creditPackage.status !== "active") {
    throw new Error("Credit package not available");
  }

  return grantCredits(db, {
    user: input.user,
    amount: creditPackage.amount,
    sourceProvider: input.sourceProvider,
    sourceType: "purchase",
    sourceId: input.sourceId,
    packageId: creditPackage.id,
    // Purchased credit packages are delivered immediately and never expire.
    expiresAt: null,
    metadata: input.metadata ?? null,
  });
}

/** Creates a web checkout session for a credit package without touching membership state. */
export async function createCreditCheckoutSession(
  db: Database,
  input: CreateCreditCheckoutSessionInput,
): Promise<CheckoutSessionResult & { creditOrderId: string }> {
  assertCreditsEnabled();
  const now = new Date();
  const creditPackage = findCreditPackageById(creditsConfig, input.packageId);
  if (!creditPackage || creditPackage.status !== "active" || !creditPackage.web) {
    throw new Error("Credit package not available");
  }
  if (creditPackage.web.status !== "active") {
    throw new Error("Credit package not available");
  }
  if (input.provider && input.provider !== creditPackage.web.provider) {
    throw new Error("Credit package provider mismatch");
  }

  const existingCustomer = await findBillingCustomer(db, {
    userId: input.user.userId,
    provider: creditPackage.web.provider,
  });
  const { getPaymentProvider } = await import("@/payments/providers");
  const provider = getPaymentProvider(creditPackage.web.provider);
  const orderId = crypto.randomUUID();

  await db.insert(creditOrder).values({
    id: orderId,
    userId: input.user.userId,
    packageId: creditPackage.id,
    provider: creditPackage.web.provider,
    providerSessionId: null,
    providerPaymentId: null,
    status: "pending",
    creditAmount: creditPackage.amount,
    amountCents: creditPackage.web.amountCents,
    currency: creditPackage.web.currency,
    ledgerTransactionId: null,
    sourceTemplateId: input.templateId ?? null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const session = await provider.createCheckoutSession({
      mode: "payment",
      lineItems: [{ priceId: creditPackage.web.providerPriceId, quantity: 1 }],
      currency: creditPackage.web.currency,
      successUrl: input.returnUrl,
      cancelUrl: input.returnUrl,
      metadata: {
        // Webhooks use this marker to route payment sessions into the credit ledger.
        kind: "credit_purchase",
        userId: input.user.userId,
        creditPackageId: creditPackage.id,
        creditOrderId: orderId,
        provider: creditPackage.web.provider,
        ...(input.templateId ? { templateId: input.templateId } : {}),
      },
      ...(existingCustomer?.providerCustomerId
        ? { customerId: existingCustomer.providerCustomerId }
        : {}),
      ...((existingCustomer?.email ?? input.customerEmail)
        ? { customerEmail: existingCustomer?.email ?? input.customerEmail! }
        : {}),
    });

    await db
      .update(creditOrder)
      .set({
        providerSessionId: session.providerSessionId,
        expiresAt: session.expiresAt ?? null,
        updatedAt: new Date(),
      })
      .where(eq(creditOrder.id, orderId));

    return { ...session, creditOrderId: orderId };
  } catch (error) {
    await db
      .update(creditOrder)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(creditOrder.id, orderId));
    throw error;
  }
}

/** Completes an order and writes the credit ledger purchase exactly once. */
export async function completeCreditOrderPurchase(
  db: Database,
  input: CompleteCreditOrderPurchaseInput,
) {
  assertCreditsEnabled();

  const [order] = await db
    .select()
    .from(creditOrder)
    .where(eq(creditOrder.id, input.orderId))
    .limit(1);

  if (!order) {
    throw new Error("Credit order not found");
  }
  if (order.status === "completed" && order.ledgerTransactionId) {
    return order;
  }
  if (order.status === "refunded") {
    return order;
  }

  const transaction = await grantCreditPackagePurchase(db, {
    user: { userId: order.userId },
    packageId: order.packageId,
    sourceProvider: input.sourceProvider,
    sourceId: input.sourceId,
    metadata: {
      ...input.metadata,
      creditOrderId: order.id,
    },
  });

  const now = new Date();
  await db
    .update(creditOrder)
    .set({
      status: "completed",
      providerSessionId: input.providerSessionId ?? order.providerSessionId,
      providerPaymentId: input.providerPaymentId ?? input.sourceId,
      ledgerTransactionId: transaction?.id ?? order.ledgerTransactionId,
      updatedAt: now,
    })
    .where(eq(creditOrder.id, order.id));

  const [updated] = await db
    .select()
    .from(creditOrder)
    .where(eq(creditOrder.id, order.id))
    .limit(1);
  return updated ?? order;
}

/** Marks a pending credit order as failed or expired without writing ledger credits. */
export async function markCreditOrderStatus(db: Database, input: MarkCreditOrderStatusInput) {
  assertCreditsEnabled();

  await db
    .update(creditOrder)
    .set({
      status: input.status,
      providerPaymentId: input.providerPaymentId ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(creditOrder.id, input.orderId), eq(creditOrder.status, "pending")));
}

/** Marks a completed credit order as refunded after the provider confirms a refund. */
export async function markCreditOrderRefunded(db: Database, input: MarkCreditOrderRefundedInput) {
  assertCreditsEnabled();

  const updated = await db
    .update(creditOrder)
    .set({
      status: "refunded",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(creditOrder.provider, input.sourceProvider),
        eq(creditOrder.providerPaymentId, input.providerPaymentId),
      ),
    )
    .returning({ id: creditOrder.id });

  return updated.length > 0;
}

/** Revokes the unspent remainder of one original purchased credit transaction. */
export async function revokeCreditPurchase(db: Database, input: RevokeCreditPurchaseInput) {
  assertCreditsEnabled();
  await ensureCreditAccount(db, input.user.userId);

  const refundSource = {
    sourceProvider: input.originalSourceProvider,
    sourceType: "refund",
    sourceId: input.refundSourceId,
  } satisfies CreditSource;

  for (let attempt = 0; attempt < 2; attempt++) {
    const existingRefund = await findTransactionBySource(db, refundSource);
    const purchase = await findTransactionBySource(db, {
      sourceProvider: input.originalSourceProvider,
      sourceType: "purchase",
      sourceId: input.originalSourceId,
    });
    if (!purchase || purchase.userId !== input.user.userId) {
      return existingRefund ?? null;
    }

    if (existingRefund) {
      const remainingRefundAmount = Math.min(
        purchase.remainingAmount,
        Math.abs(existingRefund.amount),
      );
      if (remainingRefundAmount > 0) {
        await runCreditBatch(db, [
          db
            .update(creditTransaction)
            .set({
              remainingAmount: sql`${creditTransaction.remainingAmount} - ${remainingRefundAmount}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(creditTransaction.id, purchase.id),
                gte(creditTransaction.remainingAmount, remainingRefundAmount),
              ),
            ),
          createBatchChangeGuard(db, refundSource),
          createAccountDebitUpdate(db, {
            userId: input.user.userId,
            amount: remainingRefundAmount,
            field: "totalRevoked",
            now: new Date(),
            requireAvailableBalance: true,
          }),
          createBatchChangeGuard(db, refundSource),
        ]);
      }
      return existingRefund;
    }

    if (purchase.remainingAmount <= 0) {
      return null;
    }

    const now = new Date();
    const amountToRevoke = purchase.remainingAmount;
    // Refunds only remove the unspent remainder from the original purchase.
    try {
      await runCreditBatch(db, [
        db.insert(creditTransaction).values({
          id: crypto.randomUUID(),
          userId: input.user.userId,
          amount: -amountToRevoke,
          remainingAmount: 0,
          sourceProvider: input.originalSourceProvider,
          sourceType: "refund",
          sourceId: input.refundSourceId,
          packageId: purchase.packageId,
          expiresAt: null,
          metadata: input.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        }),
        db
          .update(creditTransaction)
          .set({
            remainingAmount: sql`${creditTransaction.remainingAmount} - ${amountToRevoke}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(creditTransaction.id, purchase.id),
              gte(creditTransaction.remainingAmount, amountToRevoke),
            ),
          ),
        createBatchChangeGuard(db, refundSource),
        createAccountDebitUpdate(db, {
          userId: input.user.userId,
          amount: amountToRevoke,
          field: "totalRevoked",
          now,
          requireAvailableBalance: true,
        }),
        createBatchChangeGuard(db, refundSource),
      ]);
    } catch (error) {
      const existing = await findTransactionBySource(db, refundSource);
      if (existing) {
        return existing;
      }
      if (attempt === 0) {
        continue;
      }
      throw error;
    }

    return findTransactionBySource(db, refundSource);
  }

  return null;
}

/** Looks up the original purchase by source tuple before revoking remaining credits. */
export async function revokeCreditPurchaseBySource(
  db: Database,
  input: RevokeCreditPurchaseBySourceInput,
) {
  const purchase = await findTransactionBySource(db, {
    sourceProvider: input.originalSourceProvider,
    sourceType: "purchase",
    sourceId: input.originalSourceId,
  });

  if (!purchase) {
    return null;
  }

  return revokeCreditPurchase(db, {
    user: { userId: purchase.userId },
    originalSourceProvider: input.originalSourceProvider,
    originalSourceId: input.originalSourceId,
    refundSourceId: input.refundSourceId,
    metadata: input.metadata ?? null,
  });
}

/** Consumes credits with idempotency and rejects requests that would make balance negative. */
export async function consumeCredits(
  db: Database,
  input: ConsumeCreditsInput,
  serviceContext: CreditServiceContext = {},
) {
  assertCreditsEnabled();
  assertPositiveAmount(input.amount);
  await ensureSignupGrant(db, input.user, serviceContext);

  const usageSource = {
    sourceProvider: "app",
    sourceType: "usage",
    sourceId: input.idempotencyKey,
  } satisfies CreditSource;

  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await findTransactionBySource(db, usageSource);
    if (existing) {
      return getBalance(db, input.user, serviceContext);
    }

    const now = new Date();
    const grantRows = await db
      .select()
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, input.user.userId),
          gt(creditTransaction.remainingAmount, 0),
          or(isNull(creditTransaction.expiresAt), gt(creditTransaction.expiresAt, now)),
        ),
      )
      .orderBy(asc(creditTransaction.createdAt));
    // Spend expiring credits first, then fall back to permanent paid credits.
    const grants = grantRows.sort((a, b) => {
      const aExpiry = a.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const bExpiry = b.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return aExpiry - bExpiry || a.createdAt.getTime() - b.createdAt.getTime();
    });
    const available = grants.reduce((sum, item) => sum + item.remainingAmount, 0);
    if (available < input.amount) {
      throw new Error("Insufficient credits");
    }

    let remainingToConsume = input.amount;
    const batch: CreditBatchItem[] = [
      db.insert(creditTransaction).values({
        id: crypto.randomUUID(),
        userId: input.user.userId,
        amount: -input.amount,
        remainingAmount: 0,
        sourceProvider: "app",
        sourceType: "usage",
        sourceId: input.idempotencyKey,
        packageId: null,
        expiresAt: null,
        metadata: input.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      }),
      createAccountDebitUpdate(db, {
        userId: input.user.userId,
        amount: input.amount,
        field: "totalConsumed",
        now,
        requireAvailableBalance: true,
      }),
      createBatchChangeGuard(db, usageSource),
    ];

    for (const grant of grants) {
      if (remainingToConsume <= 0) {
        break;
      }

      const consumedFromGrant = Math.min(grant.remainingAmount, remainingToConsume);
      remainingToConsume -= consumedFromGrant;
      batch.push(
        db
          .update(creditTransaction)
          .set({
            remainingAmount: sql`${creditTransaction.remainingAmount} - ${consumedFromGrant}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(creditTransaction.id, grant.id),
              eq(creditTransaction.userId, input.user.userId),
              gte(creditTransaction.remainingAmount, consumedFromGrant),
              or(isNull(creditTransaction.expiresAt), gt(creditTransaction.expiresAt, now)),
            ),
          ),
        createBatchChangeGuard(db, usageSource),
      );
    }

    try {
      await runCreditBatch(db, batch);
      return getBalance(db, input.user, serviceContext);
    } catch (error) {
      const existing = await findTransactionBySource(db, usageSource);
      if (existing) {
        return getBalance(db, input.user, serviceContext);
      }
      if (attempt === 0) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Insufficient credits");
}

/** Expires remaining credits whose grant rows have an expiration timestamp in the past. */
export async function expireCredits(db: Database, now = new Date()) {
  assertCreditsEnabled();
  // Paid credit packages have null expiresAt, so only expiring free grants are selected here.
  const expiredGrants = await db
    .select()
    .from(creditTransaction)
    .where(and(gt(creditTransaction.remainingAmount, 0), lte(creditTransaction.expiresAt, now)));

  let expiredAmount = 0;
  for (const grant of expiredGrants) {
    const expirationSource = {
      sourceProvider: "system",
      sourceType: "expiration",
      sourceId: grant.id,
    } satisfies CreditSource;

    for (let attempt = 0; attempt < 2; attempt++) {
      const [reloadedGrant] =
        attempt === 0
          ? [grant]
          : await db
              .select()
              .from(creditTransaction)
              .where(eq(creditTransaction.id, grant.id))
              .limit(1);
      const latestGrant = reloadedGrant ?? null;
      if (!latestGrant || latestGrant.remainingAmount <= 0) {
        break;
      }

      const existingExpiration = await findTransactionBySource(db, expirationSource);
      const amount = existingExpiration
        ? Math.min(latestGrant.remainingAmount, Math.abs(existingExpiration.amount))
        : latestGrant.remainingAmount;
      if (amount <= 0) {
        break;
      }

      const batch: CreditBatchItem[] = [
        ...(existingExpiration
          ? []
          : [
              db.insert(creditTransaction).values({
                id: crypto.randomUUID(),
                userId: latestGrant.userId,
                amount: -amount,
                remainingAmount: 0,
                sourceProvider: "system",
                sourceType: "expiration",
                sourceId: latestGrant.id,
                packageId: latestGrant.packageId,
                expiresAt: null,
                metadata: { expiredTransactionId: latestGrant.id },
                createdAt: now,
                updatedAt: now,
              }),
            ]),
        db
          .update(creditTransaction)
          .set({
            remainingAmount: sql`${creditTransaction.remainingAmount} - ${amount}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(creditTransaction.id, latestGrant.id),
              gte(creditTransaction.remainingAmount, amount),
            ),
          ),
        createBatchChangeGuard(db, expirationSource),
        createAccountDebitUpdate(db, {
          userId: latestGrant.userId,
          amount,
          field: "totalExpired",
          now,
          requireAvailableBalance: true,
        }),
        createBatchChangeGuard(db, expirationSource),
      ];

      try {
        await runCreditBatch(db, batch);
        expiredAmount += amount;
        break;
      } catch (error) {
        const existing = await findTransactionBySource(db, expirationSource);
        if (existing && attempt === 0) {
          continue;
        }
        throw error;
      }
    }
  }

  return {
    expiredTransactions: expiredGrants.length,
    expiredAmount,
  };
}

async function expirePendingCreditOrders(db: Database, now = new Date()) {
  const staleBefore = new Date(now.getTime() - PENDING_ORDER_EXPIRATION_HOURS * 60 * 60 * 1000);
  const expired = await db
    .update(creditOrder)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(creditOrder.status, "pending"),
        or(
          lte(creditOrder.expiresAt, now),
          and(isNull(creditOrder.expiresAt), lte(creditOrder.updatedAt, staleBefore)),
        ),
      ),
    )
    .returning({ id: creditOrder.id });

  return {
    expiredOrders: expired.length,
  };
}

/** Runs scheduled credit maintenance tasks. */
export async function runCreditMaintenance(db: Database, now = new Date()) {
  if (!getConfig().enabled) {
    return {
      expiration: { expiredTransactions: 0, expiredAmount: 0 },
      orders: { expiredOrders: 0 },
    };
  }

  const expiration = await expireCredits(db, now);
  const orders = await expirePendingCreditOrders(db, now);

  return {
    expiration,
    orders,
  };
}
