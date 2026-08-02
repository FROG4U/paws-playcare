// Paws Playcare service worker — makes the app installable and gracefully
// handles being offline, WITHOUT ever serving stale booking/payment data.
//
// Strategy:
//   - Navigations (HTML): network-first → cache fallback → offline page.
//     (So logged-in pages are always fresh when online.)
//   - Static build assets & icons: stale-while-revalidate (fast, self-healing).
//   - Everything else (API calls, POSTs, cross-origin, Stripe): left alone.

const VERSION = "ppc-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Only cache genuinely-static media/fonts. App code under /_next/ is left to
// the browser: hashed & immutable in prod, always-fresh in dev (caching it
// cache-first would serve stale JS after edits).
function isStaticAsset(url) {
  if (url.pathname.startsWith("/_next/")) return false;
  return (
    url.pathname.startsWith("/brand/") ||
    /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs. Leave API, POST, Stripe and app code chunks
  // to the browser (never cache /_next/ — keeps updates instant).
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

  // HTML navigations → network first, fall back to cache, then offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Static assets → serve from cache, refresh in the background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
