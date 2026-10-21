import { isPhoneCompatibilityEmail, joinUrl } from "@repo/shared";
import { isGuestEmail } from "../lib/guest-account";

export type VideoReadyUser = {
  email: string | null;
  name: string | null;
  isAnonymous: boolean | null;
  deletedAt: Date | null;
};

/**
 * Who gets the "video ready" email, or null to skip it. Guests still on their guest.invalid
 * placeholder, phone-only accounts (placeholder email) and deleted accounts get nothing; a guest
 * renamed to their Stripe email by claimGuestAccount is no longer anonymous and does get it.
 */
export function videoReadyRecipient(
  user: VideoReadyUser | null | undefined,
): { to: string; name: string } | null {
  if (!user || user.deletedAt || user.isAnonymous) return null;
  const to = user.email?.trim();
  if (!to || !to.includes("@") || isGuestEmail(to) || isPhoneCompatibilityEmail(to)) return null;
  const name = user.name?.trim() || to.split("@")[0] || to;
  return { to, name };
}

/** The studio page that plays the finished render (with its soundtrack) and downloads it. */
export function videoReadyUrl(websiteUrl: string, jobId: string): string {
  return `${joinUrl(websiteUrl, "/studio")}?job=${encodeURIComponent(jobId)}`;
}
