import {
  isValidLocale,
  localeCookieName,
  localeDisplayNames,
  type Locale,
  defaultLocale as sharedDefaultLocale,
  supportedLocales,
} from "@repo/i18n";

/**
 * i18n configuration
 * Locale definitions are imported from @repo/i18n (single source of truth)
 */

export const defaultLocale = sharedDefaultLocale;
export const LOCALE_COOKIE = localeCookieName;

export { isValidLocale, localeDisplayNames, supportedLocales, type Locale };

/**
 * Paths that should ignore locale prefix (read from cookie instead)
 * e.g., /dashboard, /api, /rpc, /_serverFn
 */
export const ignoredPathsRegex = /^\/(?:_serverFn|admin|api|rpc|dashboard|users)(?:\/|$)/;

export function shouldIgnorePath(pathname: string): boolean {
  return ignoredPathsRegex.test(pathname);
}

/**
 * Extract locale from URL path
 * e.g., /zh/about -> zh, /about -> null
 */
export function extractLocaleFromPath(pathname: string): Locale | null {
  const match = /^\/([a-z]{2})(?:\/|$)/.exec(pathname);
  const locale = match?.[1];
  return locale && isValidLocale(locale) && locale !== defaultLocale ? locale : null;
}
