export function normalizeHeaderValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

export function getClientIp(headers: Headers) {
  const forwardedFor = normalizeHeaderValue(headers.get("x-forwarded-for")?.split(",")[0] ?? null);
  return (
    normalizeHeaderValue(headers.get("cf-connecting-ip")) ??
    forwardedFor ??
    normalizeHeaderValue(headers.get("x-real-ip"))
  );
}
