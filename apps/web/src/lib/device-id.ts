import {
  CLIENT_DEVICE_ID_HEADER,
  CLIENT_DEVICE_STORAGE_KEY,
  CLIENT_PLATFORM_HEADER,
  createDeviceId,
  normalizeDeviceId,
} from "@repo/shared";
import { getCookie, setCookie } from "@/lib/cookies";

const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readStoredDeviceId(): string | null {
  try {
    return normalizeDeviceId(window.localStorage.getItem(CLIENT_DEVICE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function getOrCreateWebDeviceId(): string | null {
  if (typeof window === "undefined") return null;

  const deviceId =
    readStoredDeviceId() ??
    normalizeDeviceId(getCookie(CLIENT_DEVICE_STORAGE_KEY)) ??
    createDeviceId();
  try {
    window.localStorage.setItem(CLIENT_DEVICE_STORAGE_KEY, deviceId);
  } catch {
    // Private browsing can reject localStorage. The cookie still identifies the browser.
  }
  setCookie(CLIENT_DEVICE_STORAGE_KEY, deviceId, DEVICE_COOKIE_MAX_AGE);
  return deviceId;
}

export function applyWebClientHeaders(headers: Headers): Headers {
  const deviceId = getOrCreateWebDeviceId();
  if (deviceId) headers.set(CLIENT_DEVICE_ID_HEADER, deviceId);
  headers.set(CLIENT_PLATFORM_HEADER, "web");
  return headers;
}

export function readDeviceIdFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== CLIENT_DEVICE_STORAGE_KEY) continue;
    return normalizeDeviceId(decodeURIComponent(part.slice(separator + 1).trim()));
  }
  return null;
}
