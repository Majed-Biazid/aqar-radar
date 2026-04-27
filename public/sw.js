// Service worker for الديوان — minimal offline cache.
//
//   • Pre-cache the app shell so a cold launch off-network shows the page.
//   • Network-first for /api/* — listings stay fresh online, fall back to last
//     known response when offline.
//   • Cache-first for aqar.fm thumbnails — images don't change once posted.
//   • Stale-while-revalidate for everything else (Next assets, fonts).
//
// Bump CACHE_VERSION when this file changes so old caches get evicted.

const CACHE_VERSION = "radar-v3";
const APP_SHELL = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMG_CACHE = `${CACHE_VERSION}-img`;
const ASSET_CACHE = `${CACHE_VERSION}-asset`;

const SHELL_URLS = ["/", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL)
      .then((c) => c.addAll(SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && !url.hostname.includes("aqar.fm")) {
    return; // ignore third-party (leaflet tiles etc.) — they have their own caching
  }

  // /api/* — network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // images — cache-first
  if (req.destination === "image" || url.hostname.includes("images.aqar.fm")) {
    event.respondWith(cacheFirst(req, IMG_CACHE));
    return;
  }

  // navigation — network-first with shell fallback
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, APP_SHELL));
    return;
  }

  // everything else — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (req.mode === "navigate") {
      const shell = await caches.match("/");
      if (shell) return shell;
    }
    throw new Error("offline and no cache");
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}
