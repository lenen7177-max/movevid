import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { CREDIT_SOURCE_TYPES } from "@/db/schema/credits";
import {
  creditBalanceSchema,
  creditPackageSchema,
  creditPlatformSchema,
  listCreditOrdersOutputSchema,
  listCreditTransactionsOutputSchema,
} from "@/credits/public/schemas";
import type { Context } from "@/lib/context";
import { protectedProcedure, publicProcedure } from "@/lib/orpc";

/** Resolves the authenticated user for protected credit endpoints. */
function resolveCreditUser(context: Context): { userId: string } {
  const userId = context.session?.user.id;
  if (!userId) {
    throw new ORPCError("UNAUTHORIZED", {
      message: context.t("errors.unauthorized"),
    });
  }

  return { userId };
}

/** Input schema for package listing by client platform. */
const listPackagesInputSchema = z.object({
  platform: creditPlatformSchema.default("web"),
});

/** Shared input schema for paginated credit lists. */
const paginatedCreditsInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(50).default(10),
});

/** Input schema for paginated ledger history. */
const listTransactionsInputSchema = paginatedCreditsInputSchema.extend({
  sourceType: z.enum(CREDIT_SOURCE_TYPES).optional(),
});

/** Input schema for idempotent credit consumption. */
const consumeInputSchema = z.object({
  amount: z.number().int().positive(),
  idempotencyKey: z.string().min(8).max(120),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

/** Credit API routes: packages, balance and history. */
export const creditsRouter = {
  listPackages: publicProcedure
    .input(listPackagesInputSchema)
    .output(z.array(creditPackageSchema))
    .handler(({ context, input }) => context.credits.listPackages(input)),

  getBalance: protectedProcedure.output(creditBalanceSchema).handler(async ({ context }) => {
    const user = resolveCreditUser(context);
    return context.credits.getBalance(user);
  }),

  listTransactions: protectedProcedure
    .input(listTransactionsInputSchema)
    .output(listCreditTransactionsOutputSchema)
    .handler(({ context, input }) => {
      const user = resolveCreditUser(context);
      return context.credits.listTransactions({ user, ...input });
    }),

  listOrders: protectedProcedure
    .input(paginatedCreditsInputSchema)
    .output(listCreditOrdersOutputSchema)
    .handler(({ context, input }) => {
      const user = resolveCreditUser(context);
      return context.credits.listOrders({ user, ...input });
    }),

  consume: protectedProcedure
    .input(consumeInputSchema)
    .output(creditBalanceSchema)
    .handler(async ({ context, input }) => {
      const user = resolveCreditUser(context);
      try {
        return await context.credits.consumeCredits({
          user,
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata ?? null,
        });
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          message: error instanceof Error ? error.message : "Credit consumption failed",
        });
      }
    }),
};
