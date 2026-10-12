import { CREDIT_ORDER_STATUSES, CREDIT_SOURCE_TYPES } from "@/db/schema/credits";
import { z } from "zod";

/** Platform selector used to expose only packages available on the current client. */
export const creditPlatformSchema = z.enum(["web"]);

/** Public credit package payload shared by web and native clients. */
export const creditPackageSchema = z.object({
  id: z.string(),
  amount: z.number().int().positive(),
  platform: creditPlatformSchema,
  provider: z.string(),
  providerProductId: z.string().nullable(),
  currency: z.string(),
  amountCents: z.number().int().positive(),
});

/** Public account balance payload returned after reads and consumption. */
export const creditBalanceSchema = z.object({
  userId: z.string(),
  balance: z.number().int(),
  totalGranted: z.number().int(),
  totalConsumed: z.number().int(),
  totalExpired: z.number().int(),
  totalRevoked: z.number().int(),
  expiringCredits: z.number().int(),
});

/** Public ledger transaction payload shown in recent activity lists. */
export const creditTransactionSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  remainingAmount: z.number().int(),
  sourceProvider: z.string().min(1),
  sourceType: z.enum(CREDIT_SOURCE_TYPES),
  sourceId: z.string(),
  packageId: z.string().nullable(),
  expiresAt: z.date().nullable(),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .nullable(),
  createdAt: z.date(),
});

/** Paginated credit transaction response schema. */
export const listCreditTransactionsOutputSchema = z.object({
  data: z.array(creditTransactionSchema),
  pageCount: z.number().int(),
  total: z.number().int(),
});

/** Public credit order payload shown on purchase pages. */
export const creditOrderSchema = z.object({
  id: z.string(),
  packageId: z.string(),
  provider: z.string(),
  status: z.enum(CREDIT_ORDER_STATUSES),
  creditAmount: z.number().int(),
  amountCents: z.number().int(),
  currency: z.string(),
  credited: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** Paginated credit order response schema. */
export const listCreditOrdersOutputSchema = z.object({
  data: z.array(creditOrderSchema),
  pageCount: z.number().int(),
  total: z.number().int(),
});

/** Public credit package type. */
export type CreditPackage = z.infer<typeof creditPackageSchema>;
/** Public credit balance type. */
export type CreditBalance = z.infer<typeof creditBalanceSchema>;
/** Public credit transaction type. */
export type CreditTransaction = z.infer<typeof creditTransactionSchema>;
/** Public paginated transaction response type. */
export type ListCreditTransactionsOutput = z.infer<typeof listCreditTransactionsOutputSchema>;
/** Public credit order type. */
export type CreditOrder = z.infer<typeof creditOrderSchema>;
/** Public paginated order response type. */
export type ListCreditOrdersOutput = z.infer<typeof listCreditOrdersOutputSchema>;
