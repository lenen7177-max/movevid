const CACHE_PREFIX = "app-static-";
const CACHE_VERSION = new URL(self.location.href).searchParams.get("build") ?? "legacy";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const OFFLINE_PAGE_URL = "/offline.html";
// Keep the offline experience independent from authenticated pages and API responses.
const PRECACHE_URLS = [
  OFFLINE_PAGE_URL,
  "/manifest.webmanifest",
  "/pwa/pwa-192x192.png",
  "/pwa/pwa-512x512.png",
  "/pwa/pwa-maskable-512x512.png",
];

function isCacheableStaticAsset(request) {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;

  // Vite assets are content-hashed, so cache-first is safe without serving stale account data.
  return url.pathname.startsWith("/assets/") || url.pathname.startsWith("/pwa/");
}

async function respondWithCachedAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  // Precache only what is needed to render the offline fallback before the first network failure.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      // Never touch caches created by the application or other browser features.
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    // Navigations always use the network so session, billing, and dashboard pages are never stale.
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE_PAGE_URL)) ?? Response.error();
      }),
    );
    return;
  }

  if (isCacheableStaticAsset(event.request)) {
    event.respondWith(respondWithCachedAsset(event.request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    // Activate an update only after the user accepts the refresh prompt.
    event.waitUntil(self.skipWaiting());
  }
});
