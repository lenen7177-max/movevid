import type { CreditOrder } from "../../db/schema/credits";

type PublicCreditOrderInput = Pick<
  CreditOrder,
  | "id"
  | "packageId"
  | "provider"
  | "status"
  | "creditAmount"
  | "amountCents"
  | "currency"
  | "ledgerTransactionId"
  | "createdAt"
  | "updatedAt"
>;

export function toPublicCreditOrder(order: PublicCreditOrderInput) {
  return {
    id: order.id,
    packageId: order.packageId,
    provider: order.provider,
    status: order.status,
    creditAmount: order.creditAmount,
    amountCents: order.amountCents,
    currency: order.currency,
    credited: order.status === "completed" && order.ledgerTransactionId !== null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
