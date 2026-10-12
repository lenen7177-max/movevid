import type { Database } from "@/db";
import { ensureMembershipCredits } from "./application/membership";

/** Applies this month's subscription credits before a balance read or spend. Never blocks the caller. */
export async function topUpMembershipCredits(db: Database, userId: string): Promise<void> {
  try {
    await ensureMembershipCredits(db, userId);
  } catch (error) {
    console.error("[credits] membership top-up failed", userId, error);
  }
}
