import { ORPCError } from "@orpc/server";
import { resolveCommonConfig } from "@repo/app-config";
import { creditsConfig } from "@repo/app-config/credits";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@repo/app-config/payments/web";
import { and, count, desc, eq, gt, inArray, like, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { adjustCredits } from "@/credits/application/service";
import {
  ADMIN_OPERATION_ACTIONS,
  ADMIN_OPERATION_STATUSES,
  ADMIN_TRIAL_TIERS,
  adminMembershipGrant,
  adminOperation,
  creditAccount,
  billingPurchase,
  billingSubscription,
  user,
  type AdminOperationMetadata,
} from "@/db/schema";
import type { Context } from "@/lib/context";
import { assertPermission, adminProcedure, type AuthUserSnapshot } from "@/lib/orpc";
import { findManagedUser } from "@/lib/user-management";

const metadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const operationSchema = z.object({
  id: z.string(),
  actorUserId: z.string().nullable(),
  targetUserId: z.string().nullable(),
  actorEmail: z.string(),
  targetEmail: z.string(),
  targetName: z.string().nullable(),
  action: z.enum(ADMIN_OPERATION_ACTIONS),
  status: z.enum(ADMIN_OPERATION_STATUSES),
  reason: z.string().nullable(),
  metadata: z.record(z.string(), metadataValueSchema).nullable(),
  errorMessage: z.string().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const reasonSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => value || null);

const operationBaseInputSchema = z.object({
  userId: z.string().min(1),
  requestId: z.string().uuid().optional(),
  reason: reasonSchema,
});

const listOperationsOutputSchema = z.object({
  data: z.array(operationSchema),
  total: z.number(),
  pageCount: z.number(),
});

type OperationContext = Context & { currentUser?: AuthUserSnapshot };

function assertOperationsEnabled() {
  if (!resolveCommonConfig().admin.userManagement.enabled) throw new ORPCError("NOT_FOUND");
}

function toPublicOperation(
  row: typeof adminOperation.$inferSelect,
  targetName: string | null = null,
) {
  return { ...row, targetName, metadata: row.metadata ?? null };
}

function localizedErrorMessage(context: OperationContext, error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Insufficient credits") return context.t("errors.insufficientCredits");
  if (message === "User already has a paid membership") {
    return context.t("errors.paidMembershipAlreadyActive");
  }
  return context.t("errors.adminOperationFailed");
}

async function requireTarget(context: OperationContext, userId: string) {
  const target = await findManagedUser(context.db, userId);
  if (!target) {
    throw new ORPCError("NOT_FOUND", { message: context.t("errors.notFound") });
  }
  return target;
}

async function startOperation(
  context: OperationContext,
  input: { requestId?: string; userId: string; reason: string | null },
  action: (typeof ADMIN_OPERATION_ACTIONS)[number],
) {
  const target = await requireTarget(context, input.userId);
  const id = input.requestId ?? crypto.randomUUID();
  const [existing] = await context.db
    .select()
    .from(adminOperation)
    .where(eq(adminOperation.id, id));
  if (existing) {
    if (existing.action !== action || existing.targetUserId !== target.id) {
      throw new ORPCError("CONFLICT", {
        message: context.t("errors.operationRequestConflict"),
      });
    }
    return { operation: existing, target, existing: true as const };
  }

  const now = new Date();
  const operation = {
    id,
    actorUserId: context.session!.user.id,
    targetUserId: target.id,
    actorEmail: context.session!.user.email,
    targetEmail: target.email,
    action,
    status: "pending" as const,
    reason: input.reason,
    metadata: null,
    errorMessage: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await context.db.insert(adminOperation).values(operation);
  return { operation, target, existing: false as const };
}

async function finishOperation(
  context: OperationContext,
  operationId: string,
  status: "succeeded" | "failed",
  metadata: AdminOperationMetadata | null,
  failure: string | null = null,
) {
  const now = new Date();
  await context.db
    .update(adminOperation)
    .set({ status, metadata, errorMessage: failure, completedAt: now, updatedAt: now })
    .where(eq(adminOperation.id, operationId));
  const [operation] = await context.db
    .select()
    .from(adminOperation)
    .where(eq(adminOperation.id, operationId));
  return operation!;
}

async function getTrialSchedule(context: OperationContext, userId: string, now: Date) {
  const [[subscription], [purchase], [scheduledGrant]] = await Promise.all([
    context.db
      .select({ id: billingSubscription.id })
      .from(billingSubscription)
      .where(
        and(
          eq(billingSubscription.userId, userId),
          inArray(billingSubscription.status, [...ACTIVE_SUBSCRIPTION_STATUSES]),
        ),
      )
      .limit(1),
    context.db
      .select({ id: billingPurchase.id })
      .from(billingPurchase)
      .where(and(eq(billingPurchase.userId, userId), eq(billingPurchase.status, "succeeded")))
      .limit(1),
    context.db
      .select({ tier: adminMembershipGrant.tier, expiresAt: adminMembershipGrant.expiresAt })
      .from(adminMembershipGrant)
      .where(and(eq(adminMembershipGrant.userId, userId), gt(adminMembershipGrant.expiresAt, now)))
      .orderBy(desc(adminMembershipGrant.expiresAt))
      .limit(1),
  ]);
  return {
    hasPaidMembership: Boolean(subscription || purchase),
    scheduledGrant: scheduledGrant ?? null,
  };
}

export const adminOperationsRouter = {
  getTrialSchedule: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .output(
      z.object({
        hasPaidMembership: z.boolean(),
        scheduledTier: z.enum(ADMIN_TRIAL_TIERS).nullable(),
        scheduledThrough: z.date().nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      assertOperationsEnabled();
      assertPermission(context, "membership", "grant-trial");
      await requireTarget(context, input.userId);
      const schedule = await getTrialSchedule(context, input.userId, new Date());
      return {
        hasPaidMembership: schedule.hasPaidMembership,
        scheduledTier: schedule.scheduledGrant?.tier ?? null,
        scheduledThrough: schedule.scheduledGrant?.expiresAt ?? null,
      };
    }),

  getCreditBalance: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .output(z.object({ balance: z.number().int() }))
    .handler(async ({ context, input }) => {
      assertOperationsEnabled();
      assertPermission(context, "credits", "adjust");
      if (!creditsConfig.enabled) throw new ORPCError("NOT_FOUND");
      await requireTarget(context, input.userId);
      const [account] = await context.db
        .select({ balance: creditAccount.balance })
        .from(creditAccount)
        .where(eq(creditAccount.userId, input.userId));
      return { balance: account?.balance ?? 0 };
    }),

  adjustCredits: adminProcedure
    .input(
      operationBaseInputSchema.extend({
        amount: z
          .number()
          .int()
          .min(-1_000_000)
          .max(1_000_000)
          .refine((value) => value !== 0),
      }),
    )
    .output(z.object({ operation: operationSchema, balance: z.number().int() }))
    .handler(async ({ context, input }) => {
      assertOperationsEnabled();
      assertPermission(context, "credits", "adjust");
      if (!creditsConfig.enabled) throw new ORPCError("NOT_FOUND");
      const started = await startOperation(context, input, "credits.adjust");
      if (started.existing && started.operation.status === "succeeded") {
        return {
          operation: toPublicOperation(started.operation),
          balance: Number(started.operation.metadata?.afterBalance ?? 0),
        };
      }

      try {
        const [before] = await context.db
          .select({ balance: creditAccount.balance })
          .from(creditAccount)
          .where(eq(creditAccount.userId, input.userId));
        const result = await adjustCredits(context.db, {
          user: { userId: input.userId },
          amount: input.amount,
          idempotencyKey: started.operation.id,
          metadata: { operationId: started.operation.id },
        });
        const operation = await finishOperation(context, started.operation.id, "succeeded", {
          amount: input.amount,
          beforeBalance: before?.balance ?? 0,
          afterBalance: result.balance,
        });
        return { operation: toPublicOperation(operation), balance: result.balance };
      } catch (error) {
        const message = localizedErrorMessage(context, error);
        await finishOperation(context, started.operation.id, "failed", null, message);
        throw new ORPCError("BAD_REQUEST", { message });
      }
    }),

  grantTrial: adminProcedure
    .input(
      operationBaseInputSchema.extend({
        tier: z.enum(ADMIN_TRIAL_TIERS),
        durationDays: z.number().int().min(1).max(365),
      }),
    )
    .output(z.object({ operation: operationSchema, expiresAt: z.date() }))
    .handler(async ({ context, input }) => {
      assertOperationsEnabled();
      assertPermission(context, "membership", "grant-trial");
      const started = await startOperation(context, input, "membership.grant_trial");
      if (started.existing && started.operation.status === "succeeded") {
        return {
          operation: toPublicOperation(started.operation),
          expiresAt: new Date(String(started.operation.metadata?.expiresAt)),
        };
      }

      try {
        const [existingGrant] = await context.db
          .select()
          .from(adminMembershipGrant)
          .where(eq(adminMembershipGrant.id, started.operation.id));
        if (existingGrant) {
          const previousExpiresAt =
            existingGrant.startsAt.getTime() > existingGrant.createdAt.getTime()
              ? existingGrant.startsAt.toISOString()
              : null;
          const operation = await finishOperation(context, started.operation.id, "succeeded", {
            tier: existingGrant.tier,
            durationDays: Math.round(
              (existingGrant.expiresAt.getTime() - existingGrant.startsAt.getTime()) / 86_400_000,
            ),
            previousExpiresAt,
            startsAt: existingGrant.startsAt.toISOString(),
            expiresAt: existingGrant.expiresAt.toISOString(),
          });
          return {
            operation: toPublicOperation(operation),
            expiresAt: existingGrant.expiresAt,
          };
        }

        const now = new Date();
        const schedule = await getTrialSchedule(context, input.userId, now);
        if (schedule.hasPaidMembership) throw new Error("User already has a paid membership");
        const previousExpiresAt = schedule.scheduledGrant?.expiresAt ?? null;
        const startsAt = previousExpiresAt ?? now;
        const expiresAt = new Date(startsAt);
        expiresAt.setUTCDate(expiresAt.getUTCDate() + input.durationDays);
        await context.db.insert(adminMembershipGrant).values({
          id: started.operation.id,
          userId: input.userId,
          tier: input.tier,
          startsAt,
          expiresAt,
          grantedByUserId: context.session!.user.id,
          reason: input.reason,
          createdAt: now,
          updatedAt: now,
        });
        const operation = await finishOperation(context, started.operation.id, "succeeded", {
          tier: input.tier,
          durationDays: input.durationDays,
          previousExpiresAt: previousExpiresAt?.toISOString() ?? null,
          startsAt: startsAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
        });
        return { operation: toPublicOperation(operation), expiresAt };
      } catch (error) {
        const message = localizedErrorMessage(context, error);
        await finishOperation(context, started.operation.id, "failed", null, message);
        throw new ORPCError("BAD_REQUEST", { message });
      }
    }),

  list: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(20),
        search: z.string().trim().max(200).optional(),
        actions: z.array(z.enum(ADMIN_OPERATION_ACTIONS)).default([]),
        statuses: z.array(z.enum(ADMIN_OPERATION_STATUSES)).default([]),
      }),
    )
    .output(listOperationsOutputSchema)
    .handler(async ({ context, input }) => {
      assertOperationsEnabled();
      assertPermission(context, "operation", "list");
      const targetUser = alias(user, "admin_operation_target_user");
      const conditions: SQL[] = [];
      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(like(targetUser.name, pattern));
      }
      if (input.actions.length > 0) {
        conditions.push(inArray(adminOperation.action, input.actions));
      }
      if (input.statuses.length > 0) {
        conditions.push(inArray(adminOperation.status, input.statuses));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const [rows, totals] = await Promise.all([
        context.db
          .select({ operation: adminOperation, targetName: targetUser.name })
          .from(adminOperation)
          .leftJoin(targetUser, eq(adminOperation.targetUserId, targetUser.id))
          .where(where)
          .orderBy(desc(adminOperation.createdAt))
          .limit(input.perPage)
          .offset((input.page - 1) * input.perPage),
        context.db
          .select({ count: count() })
          .from(adminOperation)
          .leftJoin(targetUser, eq(adminOperation.targetUserId, targetUser.id))
          .where(where),
      ]);
      const total = totals.at(0)?.count ?? 0;
      return {
        data: rows.map((row) => toPublicOperation(row.operation, row.targetName)),
        total,
        pageCount: Math.ceil(total / input.perPage),
      };
    }),
};
