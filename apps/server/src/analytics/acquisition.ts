import type { Database } from "../db";
import { userAcquisition } from "../db/schema/acquisition";
import { classifyAcquisitionChannel } from "./acquisition-channel";

export type AcquisitionInput = {
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPath?: string;
  firstSeenAt?: number;
};

/** Stores the user's first-touch source once; later calls for the same user are ignored. */
export async function recordUserAcquisition(
  db: Database,
  userId: string,
  input: AcquisitionInput,
): Promise<boolean> {
  const inserted = await db
    .insert(userAcquisition)
    .values({
      userId,
      channel: classifyAcquisitionChannel(input),
      referrerHost: input.referrerHost ?? null,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      landingPath: input.landingPath ?? null,
      firstSeenAt: input.firstSeenAt ? new Date(input.firstSeenAt) : null,
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ userId: userAcquisition.userId });
  return inserted.length > 0;
}
