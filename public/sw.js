const CACHE_VERSION = "v1";
const PUBLIC_CACHE = `onoprop-public-${CACHE_VERSION}`;
const PRECACHE_URLS = [
  "/sin-conexion.html",
  "/site-onoprop.webmanifest",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/maskable-192.png",
  "/pwa/maskable-512.png",
  "/pwa/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PUBLIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("onoprop-public-") && key !== PUBLIC_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

const isPublicStaticRequest = (request) => {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;

  return url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/pwa/") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/FaviconONOProp2.ico";
};

const servePublicStatic = async (request) => {
  const cache = await caches.open(PUBLIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const {request} = event;

  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/sin-conexion.html")),
    );
    return;
  }

  if (isPublicStaticRequest(request)) {
    event.respondWith(servePublicStatic(request));
  }
});
