// Service worker: makes the app installable and keeps the programme readable offline
// (festival Wi-Fi). Pages and data are network-first, so online visitors always get the
// latest programme; the cache is only a fallback. The /api is never cached.
const CACHE = "limmud2026-v1";
const SHELL = ["/", "/data.json", "/changes.json", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) =>
    fetch(u, { credentials: "same-origin" }).then((r) => (r.ok && r.type === "basic" ? c.put(u, r) : null)).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: cache-first, so the app keeps its look offline
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/cdn-cgi/")) return;

  const key = req.mode === "navigate" ? "/" : url.pathname;
  e.respondWith(
    fetch(req).then((r) => {
      // only cache real content; an Access login redirect passes straight through
      if (r.ok && r.type === "basic") { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return r;
    }).catch(async () => (await caches.match(key)) || Response.error())
  );
});
