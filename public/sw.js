/* Service worker: caches static assets only. API and auth requests are never cached.
   GPS recording does NOT run here: browsers do not allow background geolocation from a service worker. */
const CACHE = "ldp-shell-v1";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/manifest.webmanifest", "/icons/icon.svg"])).catch(() => undefined)); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request)) ?? fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; })));
  }
});
