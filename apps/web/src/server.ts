import handler from "@tanstack/react-start/server-entry";
import { extractLocaleFromPath, shouldIgnorePath } from "./i18n/config";
import { applyLocaleMiddleware, handleLocaleMiddleware } from "./i18n/server";
import { isIndexableHost } from "./lib/seo/indexable-host";

declare const __PWA_BUILD_ID__: string;

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

const noIndexPathRegex = /^\/(?:admin|auth|billing|credits|dashboard|settings|users)(?:\/|$)/;

function stripLocalePrefix(pathname: string): string {
  const locale = extractLocaleFromPath(pathname);
  if (!locale) {
    return pathname;
  }

  const prefix = `/${locale}`;
  if (pathname === prefix) {
    return "/";
  }

  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

function shouldApplyNoIndex(pathname: string): boolean {
  return noIndexPathRegex.test(stripLocalePrefix(pathname));
}

// Pages on any host but the canonical one (workers.dev and preview URLs) are never indexed,
// whatever the path. The canonical apex keeps the path rules only.
function applyNoIndexHeader(response: Response, url: URL): Response {
  const indexableHost = isIndexableHost(url.hostname, import.meta.env.VITE_APP_URL);
  if (indexableHost && !shouldApplyNoIndex(url.pathname)) {
    return response;
  }

  const nextResponse = new Response(response.body, response);
  nextResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
  return nextResponse;
}

// Public pages render the same HTML for every visitor (locale comes from the path, session loads
// client-side), so they are kept in the edge cache instead of being rendered on every request.
// The build id in the key drops cached HTML on deploy, before it can point at removed assets.
const HTML_CACHE_SECONDS = 60 * 60;

function isCacheablePage(req: Request, url: URL): boolean {
  return (
    import.meta.env.PROD &&
    typeof caches !== "undefined" &&
    req.method === "GET" &&
    !url.search &&
    !shouldIgnorePath(url.pathname) &&
    !shouldApplyNoIndex(url.pathname)
  );
}

function htmlCacheKey(url: URL): Request {
  return new Request(`${url.origin}${url.pathname}?build=${__PWA_BUILD_ID__}`);
}

async function renderPage(req: Request, url: URL, ctx?: WorkerContext): Promise<Response> {
  if (!isCacheablePage(req, url)) {
    return handler.fetch(req);
  }

  const cache = await caches.open("html-pages");
  const key = htmlCacheKey(url);
  const cached = await cache.match(key);
  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.delete("Cache-Control");
    hit.headers.set("X-Html-Cache", "HIT");
    return hit;
  }

  const response = await handler.fetch(req);
  const isHtml = response.headers.get("Content-Type")?.startsWith("text/html");
  if (response.status !== 200 || !isHtml || response.headers.has("Set-Cookie")) {
    return response;
  }

  const stored = new Response(response.clone().body, response);
  stored.headers.set("Cache-Control", `public, max-age=${HTML_CACHE_SECONDS}`);
  const put = cache.put(key, stored);
  if (ctx) {
    ctx.waitUntil(put);
  } else {
    await put;
  }

  const miss = new Response(response.body, response);
  miss.headers.set("X-Html-Cache", "MISS");
  return miss;
}

// www and plain-http requests answer with a 301 to the canonical https apex, so search engines
// index one URL per page. Other hosts (localhost, workers.dev previews) are not redirected; they
// answer with X-Robots-Tag: noindex instead (applyNoIndexHeader).
function canonicalRedirect(url: URL): Response | null {
  const appUrl: string | undefined = import.meta.env.VITE_APP_URL;
  if (!appUrl) return null;
  const canonical = new URL(appUrl);
  if (url.hostname.replace(/^www\./, "") !== canonical.hostname) return null;
  if (url.hostname === canonical.hostname && url.protocol === canonical.protocol) return null;
  return Response.redirect(`${canonical.origin}${url.pathname}${url.search}`, 301);
}

export default {
  async fetch(req: Request, _env?: unknown, ctx?: WorkerContext): Promise<Response> {
    const url = new URL(req.url);
    const redirect = canonicalRedirect(url);
    if (redirect) return redirect;
    const localeResult = handleLocaleMiddleware(req);

    const response = localeResult.redirect ?? (await renderPage(req, url, ctx));
    const localeResponse = applyLocaleMiddleware(response, localeResult);
    return applyNoIndexHeader(localeResponse, url);
  },
};
