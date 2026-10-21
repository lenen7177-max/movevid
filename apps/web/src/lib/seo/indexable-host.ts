/**
 * Whether a request host is the production site that search engines should index: the host of
 * the canonical app URL (VITE_APP_URL), or its www variant, which 301s to it. Everything else
 * (workers.dev and preview URLs, other custom domains) gets `X-Robots-Tag: noindex, nofollow`.
 * Without a configured app URL nothing is known about the canonical host, so every host counts
 * as indexable and the header is left to the path rules.
 *
 * Kept free of imports so the node tests can load it directly.
 */
export function isIndexableHost(hostname: string, appUrl: string | undefined): boolean {
  if (!appUrl) return true;
  let canonical: string;
  try {
    canonical = new URL(appUrl).hostname.toLowerCase();
  } catch {
    return true;
  }
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const apex = canonical.replace(/^www\./, "");
  return host === canonical || host === apex || host === `www.${apex}`;
}
