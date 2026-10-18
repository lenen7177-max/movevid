import { authClient } from "@/lib/auth/auth-client";

/**
 * Guests order without signing in: the first Generate or Buy click signs this browser in as an
 * anonymous user. Paying gives the guest the email they enter at checkout, and signing in later
 * moves their credits and videos onto that account (apps/server/src/lib/guest-account.ts).
 */
export function isGuestUser(user: object | null | undefined): boolean {
  return Boolean(user && "isAnonymous" in user && user.isAnonymous === true);
}

/** Resolves once the browser has a session, starting a guest one if needed; false on failure. */
export async function ensureSession(): Promise<boolean> {
  const { data } = await authClient.getSession();
  if (data?.user) return true;
  const { error } = await authClient.signIn.anonymous();
  return !error;
}
