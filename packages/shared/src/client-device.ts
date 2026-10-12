export const CLIENT_DEVICE_ID_HEADER = "x-device-id";
export const CLIENT_PLATFORM_HEADER = "x-client-platform";
export const CLIENT_DEVICE_STORAGE_KEY = "es_device";
export const CLIENT_PLATFORMS = ["web", "native", "extension"] as const;

export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];

const DEVICE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createDeviceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function normalizeDeviceId(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || !DEVICE_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function normalizeClientPlatform(value: string | null | undefined): ClientPlatform | null {
  if (value === "web" || value === "native" || value === "extension") return value;
  return null;
}
