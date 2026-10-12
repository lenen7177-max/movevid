export function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashNamespacedValue(
  value: string | null | undefined,
  namespace: string,
  secret: string | null | undefined,
) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const encoder = new TextEncoder();
  const payload = encoder.encode(`${namespace}:${normalized}`);
  const trimmedSecret = secret?.trim();
  if (!trimmedSecret) {
    return toHex(await crypto.subtle.digest("SHA-256", payload));
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(trimmedSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, payload));
}
