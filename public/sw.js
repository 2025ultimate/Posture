// PostureGuard service worker — offline support for the installable app.
//
// Strategy, kept deliberately simple and readable:
//   - Navigations: network-first, falling back to the cached app shell so
//     the installed app opens with no connection.
//   - Same-origin assets and the two MediaPipe hosts (jsdelivr WASM +
//     Google model file): stale-while-revalidate. After the first
//     successful run, the pose model works fully offline.
//   - Nothing else is ever cached, and the worker makes no requests the
//     page wouldn't make itself.

const CACHE = "postureguard-v2";

const ALLOWED_HOSTS = [
  self.location.host,
  "cdn.jsdelivr.net",
  "storage.googleapis.com",
  // Public-domain exercise photos (Free Exercise DB) — cached as browsed.
  "raw.githubusercontent.com",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "./",
          "./manifest.webmanifest",
          "./pwa-192.png",
          "./pwa-512.png",
          "./apple-touch-icon.png",
        ])
      )
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!ALLOWED_HOSTS.includes(url.host)) return;

  // App navigations: try the network, fall back to the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put("./", fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match("./");
          return cached ?? Response.error();
        }
      })()
    );
    return;
  }

  // Assets: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => undefined);
      if (cached) {
        // Serve instantly; refresh in the background.
        event.waitUntil(refresh);
        return cached;
      }
      const fresh = await refresh;
      return fresh ?? Response.error();
    })()
  );
});
