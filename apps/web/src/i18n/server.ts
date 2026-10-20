/**
 * Server-side i18n utilities
 * Handles locale detection, redirects, and cookie management
 */

import { negotiateLocale } from "@repo/i18n";
import {
  defaultLocale,
  extractLocaleFromPath,
  extractUnservedLocaleFromPath,
  isValidLocale,
  LOCALE_COOKIE,
  type Locale,
  shouldIgnorePath,
} from "./config";

interface LocaleMiddlewareResult {
  redirect?: Response;
  setCookie?: { name: string; value: string };
  locale: Locale;
}

/**
 * Parse locale from cookie header
 */
function parseLocaleCookie(cookieHeader: string | null): Locale | null {
  if (!cookieHeader) return null;

  const match = new RegExp(`${LOCALE_COOKIE}=([^;]+)`).exec(cookieHeader);
  const locale = match?.[1];
  return locale && isValidLocale(locale) ? locale : null;
}

/**
 * Create Set-Cookie header value
 */
function createCookieHeader(name: string, value: string): string {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function hasFileExtension(pathname: string): boolean {
  const segment = pathname.split("/").pop() ?? "";
  return segment.includes(".");
}

/**
 * Page and app routes can be localized. Vite internals and static files cannot.
 */
function canNegotiateLocale(pathname: string): boolean {
  if (hasFileExtension(pathname)) return false;
  if (pathname.startsWith("/@")) return false;
  if (pathname.startsWith("/node_modules/")) return false;
  if (pathname.startsWith("/_build/")) return false;
  return true;
}

/**
 * Saved choice wins. Otherwise match the browser's Accept-Language list.
 */
export function getLocaleFromRequest(request: Request): Locale {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const cookieLocale = parseLocaleCookie(request.headers.get("cookie"));
  const browserLocale = negotiateLocale(request.headers.get("accept-language"));

  if (shouldIgnorePath(pathname)) {
    return cookieLocale ?? browserLocale;
  }

  const pathLocale = extractLocaleFromPath(pathname);
  if (pathLocale) return pathLocale;

  return cookieLocale ?? browserLocale;
}

function localeCookie(locale: Locale) {
  return { name: LOCALE_COOKIE, value: locale };
}

/**
 * Remember the first resolved language so later visits keep the user's choice.
 * The language switcher overwrites this same cookie.
 */
function initialLocaleCookie(request: Request, locale: Locale) {
  if (parseLocaleCookie(request.headers.get("cookie"))) return undefined;
  return localeCookie(locale);
}

export function handleLocaleMiddleware(request: Request): LocaleMiddlewareResult {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const locale = getLocaleFromRequest(request);
  const canPersist = canNegotiateLocale(pathname);
  const rememberedLocale = canPersist ? initialLocaleCookie(request, locale) : undefined;

  if (shouldIgnorePath(pathname)) {
    return { locale, setCookie: rememberedLocale };
  }

  // Redirect /en/* to /* (default locale should not have prefix)
  if (pathname.startsWith(`/${defaultLocale}/`) || pathname === `/${defaultLocale}`) {
    const newUrl = new URL(url);
    newUrl.pathname = pathname.replace(`/${defaultLocale}`, "") || "/";
    return {
      redirect: Response.redirect(newUrl.toString(), 301),
      locale: defaultLocale,
      setCookie: canPersist ? initialLocaleCookie(request, defaultLocale) : undefined,
    };
  }

  // /zh/* or /jp/* while that locale is turned off: the page lives at /* now.
  const unservedLocale = extractUnservedLocaleFromPath(pathname);
  if (unservedLocale) {
    const newUrl = new URL(url);
    newUrl.pathname = pathname.slice(unservedLocale.length + 1) || "/";
    return {
      redirect: Response.redirect(newUrl.toString(), 301),
      locale: defaultLocale,
      setCookie: canPersist ? initialLocaleCookie(request, defaultLocale) : undefined,
    };
  }

  const urlLocale = extractLocaleFromPath(pathname);

  // No locale prefix — send first-time and saved visitors of another served locale to /<locale>
  if (!urlLocale && locale !== defaultLocale && canPersist) {
    const newUrl = new URL(url);
    newUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return {
      redirect: Response.redirect(newUrl.toString(), 302),
      locale,
      setCookie: rememberedLocale,
    };
  }

  if (urlLocale) {
    const strippedPath = pathname.replace(`/${urlLocale}`, "") || "/";
    if (shouldIgnorePath(strippedPath)) {
      const newUrl = new URL(url);
      newUrl.pathname = strippedPath;
      return {
        redirect: Response.redirect(newUrl.toString(), 301),
        locale: urlLocale,
        setCookie: rememberedLocale,
      };
    }

    const cookieLocale = parseLocaleCookie(request.headers.get("cookie"));
    if (urlLocale !== cookieLocale) {
      return {
        setCookie: localeCookie(urlLocale),
        locale: urlLocale,
      };
    }
  }

  return { locale, setCookie: rememberedLocale };
}

/**
 * Apply middleware result to response
 */
export function applyLocaleMiddleware(
  response: Response,
  result: LocaleMiddlewareResult,
): Response {
  if (result.setCookie) {
    const newResponse = new Response(response.body, response);
    newResponse.headers.append(
      "Set-Cookie",
      createCookieHeader(result.setCookie.name, result.setCookie.value),
    );
    return newResponse;
  }
  return response;
}
