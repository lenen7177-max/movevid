/**
 * Parse hostname from a URL string.
 */
export function parseHostname(url: string | undefined): string | null {
  if (!url) return null;

  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Check whether a hostname is localhost or an IP address.
 */
export function isLocalOrIpHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "::1") {
    return true;
  }

  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

/**
 * Resolve a registrable-like domain by taking the last two labels.
 */
export function getRegistrableLikeDomain(hostname: string): string | null {
  if (isLocalOrIpHost(hostname)) return null;

  const parts = hostname.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(-2).join(".");
}

/**
 * Resolve cookie domain for sharing between two subdomains.
 */
export function resolveCrossSubdomainCookieDomain(
  serverUrl: string | undefined,
  websiteUrl: string | undefined,
): string | undefined {
  const serverHost = parseHostname(serverUrl);
  const websiteHost = parseHostname(websiteUrl);
  if (!serverHost || !websiteHost) return undefined;
  if (serverHost === websiteHost) return undefined;

  const serverDomain = getRegistrableLikeDomain(serverHost);
  const websiteDomain = getRegistrableLikeDomain(websiteHost);

  // Only share cookie when both endpoints are under the same root domain.
  if (!serverDomain || !websiteDomain || serverDomain !== websiteDomain) {
    return undefined;
  }

  return serverDomain;
}
