import { ORPCError } from "@orpc/server";
import { resolveCommonConfig } from "@repo/app-config";
import { creditsConfig } from "@repo/app-config/credits";
import { and, count, desc, eq, inArray, like, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { adjustCredits } from "@/credits/application/service";
import {
  ADMIN_OPERATION_ACTIONS,
  ADMIN_OPERATION_STATUSES,
  adminOperation,
  creditAccount,
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

export const adminOperationsRouter = {
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
