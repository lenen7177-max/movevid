import { and, eq } from "drizzle-orm";
import { billingCustomer } from "@/db/schema/payments";
import type { DbLike } from "../../../infrastructure/repositories/billing-store";
import type { BillingUser } from "../../../public/types";

/**
 * Resolves billing user information from Stripe metadata.
 * Falls back to provider customer mapping when metadata is missing.
 */
export async function resolveUserFromMetadata(
  db: DbLike,
  input: { metadata: Record<string, string>; providerCustomerId?: string },
): Promise<BillingUser | null> {
  const userId = input.metadata.userId;

  if (userId) {
    return { userId };
  }

  if (input.providerCustomerId) {
    const [customer] = await db
      .select()
      .from(billingCustomer)
      .where(
        and(
          eq(billingCustomer.provider, "stripe"),
          eq(billingCustomer.providerCustomerId, input.providerCustomerId),
        ),
      )
      .limit(1);

    if (customer) {
      return { userId: customer.userId };
    }
  }

  return null;
}
