const FIRST_TOUCH_KEY = "analytics.firstTouch";
const REPORTED_KEY_PREFIX = "analytics.acquisitionReported:";
// Only accounts this young get a source: an older account's first visit predates this browser's record.
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;
// Pages that send people back to us mid-flow are not where they came from.
const IGNORED_REFERRER_PATTERN =
  /(^|\.)(stripe\.com|creem\.io|waffo\.com|accounts\.google\.com|appleid\.apple\.com|github\.com)$/;

export type FirstTouch = {
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPath?: string;
  firstSeenAt?: number;
};

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the visit simply stays unattributed.
  }
}

function externalReferrerHost(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const host = new URL(document.referrer).hostname.toLowerCase();
    if (!host || host === window.location.hostname || host === `www.${window.location.hostname}`) {
      return undefined;
    }
    return IGNORED_REFERRER_PATTERN.test(host) ? undefined : host;
  } catch {
    return undefined;
  }
}

function param(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name)?.trim();
  return value ? value.slice(0, 120) : undefined;
}

/** Remembers where this browser first came from (referrer, UTM tags, landing page). Kept once. */
export function captureFirstTouch() {
  if (readStored(FIRST_TOUCH_KEY)) return;
  const params = new URLSearchParams(window.location.search);
  const touch: FirstTouch = {
    referrerHost: externalReferrerHost(),
    utmSource: param(params, "utm_source"),
    utmMedium: param(params, "utm_medium"),
    utmCampaign: param(params, "utm_campaign"),
    landingPath: window.location.pathname.slice(0, 300),
    firstSeenAt: Date.now(),
  };
  writeStored(FIRST_TOUCH_KEY, JSON.stringify(touch));
}

function readFirstTouch(): FirstTouch {
  const raw = readStored(FIRST_TOUCH_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as FirstTouch;
  } catch {
    return {};
  }
}

/**
 * The first-touch source to send for a signed-in user, or null when it was already sent or the
 * account is too old for this browser's record to describe how they found us.
 */
export function pendingAcquisition(user: {
  id: string;
  createdAt: Date | string;
}): FirstTouch | null {
  if (readStored(`${REPORTED_KEY_PREFIX}${user.id}`)) return null;
  const ageMs = Date.now() - new Date(user.createdAt).getTime();
  if (!(ageMs >= 0 && ageMs < NEW_ACCOUNT_MS)) {
    markAcquisitionReported(user.id);
    return null;
  }
  return readFirstTouch();
}

/** Stops further reports for this user in this browser (the server keeps only the first anyway). */
export function markAcquisitionReported(userId: string) {
  writeStored(`${REPORTED_KEY_PREFIX}${userId}`, "1");
}
