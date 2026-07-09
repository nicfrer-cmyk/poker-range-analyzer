// Icon version — this query string is the cache-buster for these static (non build-hashed)
// PNG files. If you change the icon images, bump it here AND in the matching literal in
// src/app/layout.tsx AND public/manifest.webmanifest (three separate files, no shared build
// step wires them together — keep them in sync by hand).
const ICON_VERSION = "3";

const CACHE_VERSION = "v3";
const CACHE_NAME = `pra-static-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE_ASSETS = [
  "/manifest.webmanifest",
  `/icons/icon-192.png?v=${ICON_VERSION}`,
  `/icons/icon-512.png?v=${ICON_VERSION}`,
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Clicking a device-notification popup (see lib/notificationsPush.ts) focuses an existing tab
// and navigates it to the notification's target, or opens a new one if none is open.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(href);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(href);
    })
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Static, versioned/immutable assets only: cache-first, since their filename or `?v=` query
  // string already changes whenever the content does.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Full-page navigations (typed URL, link click, back/forward): network-only, never cached.
  // Authenticated HTML/RSC responses must never be replayed from Cache Storage — that's both a
  // privacy leak on a shared computer and a staleness bug. Only a genuinely failed request
  // (offline) falls back to the precached, unauthenticated /offline page.
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Everything else (API calls, RSC data fetches, cross-origin requests) — no service worker
  // involvement, let the browser handle it natively.
});
