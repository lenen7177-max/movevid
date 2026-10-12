/**
 * Client-side i18n utilities
 * Handles URL rewriting and locale detection for the browser
 */

import { negotiateLocale, negotiateLocaleList } from "@repo/i18n";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
  defaultLocale,
  extractLocaleFromPath,
  isValidLocale,
  LOCALE_COOKIE,
  type Locale,
  shouldIgnorePath,
} from "./config";

const LOCALE_SWITCH_KEY = "__locale_switching";
const LOCALE_SWITCH_TTL_MS = 5000;

function hasDefaultLocalePrefix(pathname: string): boolean {
  const defaultPrefix = `/${defaultLocale}`;
  return pathname === defaultPrefix || pathname.startsWith(`${defaultPrefix}/`);
}

/**
 * Parse locale from cookie string (works on both server and client)
 */
export function parseLocaleCookie(cookieString: string | null): Locale | null {
  if (!cookieString) return null;

  const match = new RegExp(`${LOCALE_COOKIE}=([^;]+)`).exec(cookieString);
  const locale = match?.[1];
  return locale && isValidLocale(locale) ? locale : null;
}

function resolveStoredLocale(cookieString: string | null, fallback: Locale): Locale {
  return parseLocaleCookie(cookieString) ?? fallback;
}

function resolvePublicLocale(
  pathname: string,
  cookieString: string | null,
  fallback: Locale,
): Locale {
  const pathLocale = extractLocaleFromPath(pathname);
  if (pathLocale) return pathLocale;

  if (hasDefaultLocalePrefix(pathname)) {
    return defaultLocale;
  }

  return resolveStoredLocale(cookieString, fallback);
}

function localeFromBrowser(): Locale {
  const languages = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  return negotiateLocaleList(languages);
}

/**
 * Set locale cookie (client-side)
 */
export function setLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${maxAge}; SameSite=Lax`;
  // Mark a short-lived "switch in progress" flag so router output can follow it.
  try {
    sessionStorage.setItem(LOCALE_SWITCH_KEY, JSON.stringify({ locale, ts: Date.now() }));
  } catch {}
}

/**
 * Locale order: explicit URL prefix, saved locale cookie, browser language, English.
 */
export const getCurrentLocale = createIsomorphicFn()
  .server(() => {
    try {
      const request = getRequest();
      const url = new URL(request.url);
      const cookieString = request.headers.get("cookie");
      const fallback = negotiateLocale(request.headers.get("accept-language"));

      if (shouldIgnorePath(url.pathname)) {
        return resolveStoredLocale(cookieString, fallback);
      }
      return resolvePublicLocale(url.pathname, cookieString, fallback);
    } catch {
      // getRequest() may fail outside of request context
      return defaultLocale;
    }
  })
  .client(() => {
    const fallback = localeFromBrowser();

    if (shouldIgnorePath(window.location.pathname)) {
      return resolveStoredLocale(document.cookie, fallback);
    }
    return resolvePublicLocale(window.location.pathname, document.cookie, fallback);
  });

/**
 * Remove locale prefix from URL (for router input)
 * e.g., /zh/about -> /about
 */
export function deLocalizeUrl(url: URL): URL {
  if (shouldIgnorePath(url.pathname)) return url;

  const locale = extractLocaleFromPath(url.pathname);
  if (locale) {
    const newUrl = new URL(url);
    newUrl.pathname = url.pathname.replace(`/${locale}`, "") || "/";
    return newUrl;
  }
  // Also strip default-locale prefix to avoid client-side 404s.
  const defaultPrefix = `/${defaultLocale}`;
  if (url.pathname === defaultPrefix || url.pathname.startsWith(`${defaultPrefix}/`)) {
    const newUrl = new URL(url);
    newUrl.pathname = url.pathname.replace(defaultPrefix, "") || "/";
    return newUrl;
  }
  return url;
}

/**
 * Add locale prefix to URL (for router output)
 * e.g., /about -> /zh/about (if current locale is zh)
 *
 * This function detects language switching by comparing cookie vs URL locale.
 * During a switch, cookie is updated first, so we use cookie value.
 */
export function localizeUrl(url: URL): URL {
  if (shouldIgnorePath(url.pathname)) return url;

  // Check if path already has a locale prefix to avoid duplicating it
  const existingLocale = extractLocaleFromPath(url.pathname);
  if (existingLocale) return url;

  // Determine the target locale:
  // - On server: use getCurrentLocale (from URL for public pages)
  // - On client: check if we're in the middle of a language switch
  let locale: Locale;

  if (typeof window === "undefined") {
    // Server-side: use normal logic
    locale = getCurrentLocale();
  } else {
    // Client-side: detect language switching
    const cookieLocale = parseLocaleCookie(document.cookie);
    let switchingLocale: Locale | null = null;
    try {
      const raw = sessionStorage.getItem(LOCALE_SWITCH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { locale?: string; ts?: number };
        if (
          parsed?.locale &&
          parsed?.ts &&
          Date.now() - parsed.ts < LOCALE_SWITCH_TTL_MS &&
          isValidLocale(parsed.locale)
        ) {
          switchingLocale = parsed.locale as Locale;
        } else {
          sessionStorage.removeItem(LOCALE_SWITCH_KEY);
        }
      }
    } catch {}

    // Only trust the cookie during a very recent, explicit locale switch.
    if (switchingLocale && cookieLocale === switchingLocale) {
      locale = switchingLocale;
    } else {
      locale = getCurrentLocale();
    }
  }

  if (locale === defaultLocale) return url;

  const newUrl = new URL(url);
  newUrl.pathname = `/${locale}${url.pathname === "/" ? "" : url.pathname}`;
  return newUrl;
}
