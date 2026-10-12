type UserIdentityLike = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
};

// Mainland-China-only narrowing used by both client and server (aliyun-dypnsapi only delivers CN).
export const CN_PHONE_NUMBER_REGEX = /^\+86\d{11}$/;
export const CN_DIAL_PREFIX = "+86";
export const CN_LOCAL_PHONE_DIGITS = 11;

export function toCnE164PhoneNumber(localDigits: string): string {
  return `${CN_DIAL_PREFIX}${localDigits}`;
}

// Compatibility emails use a 16-hex-char HMAC digest so the stored email never leaks the raw
// phone number. The format must be URL-safe and fit RFC 5321 local-part limits. The digest is
// computed server-side (see apps/server/src/lib/phone-email.ts) so it can use node:crypto
// synchronously — Better Auth's getTempEmail callback signature is sync-only.
export const PHONE_COMPATIBILITY_EMAIL_DOMAIN = "phone-auth.invalid";
export const PHONE_COMPATIBILITY_EMAIL_PREFIX = "phone-";
export const PHONE_COMPATIBILITY_EMAIL_DIGEST_LENGTH = 16;

const PHONE_COMPATIBILITY_EMAIL_REGEX = new RegExp(
  `^${PHONE_COMPATIBILITY_EMAIL_PREFIX}[0-9a-f]{${PHONE_COMPATIBILITY_EMAIL_DIGEST_LENGTH}}@${PHONE_COMPATIBILITY_EMAIL_DOMAIN.replaceAll(".", "\\.")}$`,
  "i",
);

export function normalizePhoneDigits(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, "");
}

export function isPhoneCompatibilityEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return PHONE_COMPATIBILITY_EMAIL_REGEX.test(email);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getStableUserSuffix(user: UserIdentityLike): string {
  const seed = user.id ?? user.email ?? user.phoneNumber ?? "phone-user";
  return hashString(seed).toString(36).padStart(6, "0").slice(-6).toUpperCase();
}

// Hide compatibility emails (phone-only accounts) from user-facing surfaces.
export function getVisibleUserEmail(user: UserIdentityLike): string | null {
  const email = user.email ?? null;
  return isPhoneCompatibilityEmail(email) ? null : email;
}

export function isPhoneUser(user: UserIdentityLike): boolean {
  return Boolean(user.phoneNumber);
}

export function getVisibleUserName(user: UserIdentityLike): string | null {
  const name = user.name ?? null;
  if (!isPhoneUser(user)) return name;

  const isPhoneName = name === user.phoneNumber;
  if (name && !isPhoneName) return name;

  return `User ${getStableUserSuffix(user)}`;
}

export function getVisibleUserContact(user: UserIdentityLike): string | null {
  return getVisibleUserEmail(user) ?? user.phoneNumber ?? null;
}
