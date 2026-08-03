// Paws Playcare service worker — makes the app installable and gives an
// offline page, WITHOUT ever serving a stale page.
//
// Strategy:
//   - Navigations (HTML): ALWAYS network. Pages are never cached, so you (and
//     customers) always see the latest content. Falls back to the offline page
//     only when the device is genuinely offline.
//   - Static media/fonts: cached for speed + offline, refreshed in background.
//   - App code (/_next/), API calls, POSTs, Stripe: left entirely to the browser.

const VERSION = "ppc-v3";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Only genuinely-static media/fonts get cached. Never /_next/ (app code).
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

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

  // HTML pages → always fresh from the network; offline page only if truly offline.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Static assets → cache, refresh in the background.
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
