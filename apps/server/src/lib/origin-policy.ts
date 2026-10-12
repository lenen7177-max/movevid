import { trimTrailingSlash } from "@repo/shared";

const developmentWebOriginPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

type OriginPolicyOptions = {
  nodeEnv?: string;
  websiteUrl?: string;
};

export type OriginPolicy = {
  resolveCorsOrigin: (requestOrigin: string) => string | undefined;
  trustedBrowserOrigins: string[];
};

/** The site is reachable on both the apex and www hosts; trust whichever one WEBSITE_URL omits. */
function withWwwCounterpart(origin: string): string[] {
  if (!origin) return [];
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return [origin];
  }
  const { hostname } = url;
  if (hostname === "localhost" || /^[\d.]+$/.test(hostname) || !hostname.includes(".")) {
    return [origin];
  }
  const counterpart = new URL(origin);
  counterpart.hostname = hostname.startsWith("www.") ? hostname.slice(4) : `www.${hostname}`;
  return [origin, trimTrailingSlash(counterpart.origin)];
}

export function createOriginPolicy({ nodeEnv, websiteUrl }: OriginPolicyOptions): OriginPolicy {
  const websiteOrigin = trimTrailingSlash(websiteUrl ?? "");
  const configuredOrigins = new Set(withWwwCounterpart(websiteOrigin));
  const isDevelopment = nodeEnv === "development";

  return {
    resolveCorsOrigin(requestOrigin) {
      if (configuredOrigins.has(requestOrigin)) return requestOrigin;
      if (isDevelopment && developmentWebOriginPattern.test(requestOrigin)) return requestOrigin;
      return undefined;
    },
    trustedBrowserOrigins: [...configuredOrigins],
  };
}
