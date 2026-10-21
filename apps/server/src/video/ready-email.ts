import { resolveCommonConfig } from "@repo/app-config/config";
import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { user } from "../db/schema/auth";
import { sendVideoReadyEmail } from "../emails/senders/video-ready-email";
import { videoReadyRecipient, videoReadyUrl } from "./ready-email-recipient";

/**
 * Emails the owner that their render is done. Called only by the sync that moved the job to
 * succeeded (a conditional update), so polling and the cron never send it twice. Best effort:
 * any failure is logged and never touches the job.
 */
export async function notifyVideoReady(
  db: Database,
  env: Pick<Cloudflare.Env, "WEBSITE_URL">,
  job: { id: string; userId: string },
): Promise<void> {
  try {
    const [owner] = await db
      .select({
        email: user.email,
        name: user.name,
        isAnonymous: user.isAnonymous,
        deletedAt: user.deletedAt,
      })
      .from(user)
      .where(eq(user.id, job.userId))
      .limit(1);
    const recipient = videoReadyRecipient(owner);
    if (!recipient) return;
    const websiteUrl = env.WEBSITE_URL || resolveCommonConfig().app.websiteUrl;
    await sendVideoReadyEmail({ ...recipient, videoUrl: videoReadyUrl(websiteUrl, job.id) });
  } catch (error) {
    console.error("[video] ready email failed", job.id, error);
  }
}
