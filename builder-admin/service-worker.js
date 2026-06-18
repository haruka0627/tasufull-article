/* TASFUL Builder Admin — scope: builder-admin/ only */

/* eslint-disable no-restricted-globals */
(function () {
  "use strict";

  const VERSION = "builder-admin-v1";
  const CACHE_NAME = `tasful-${VERSION}`;
  const OFFLINE_URL = "./admin-index.html";

  const PRECACHE_URLS = [
    "./admin-index.html",
    "../builder/builder.css",
    "../builder/builder.js",
  ];

  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.addAll(PRECACHE_URLS))
        .then(() => self.skipWaiting())
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith("tasful-builder-admin") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
        await self.clients.claim();
      })()
    );
  });

  function isSameOrigin(url) {
    try {
      return new URL(url).origin === self.location.origin;
    } catch {
      return false;
    }
  }

  self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = request.url;
    if (!isSameOrigin(url)) return;

    if (request.mode === "navigate") {
      event.respondWith(
        (async () => {
          try {
            return await fetch(request);
          } catch {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(request);
            if (cached) return cached;
            const fallback = await cache.match(OFFLINE_URL);
            return (
              fallback ||
              new Response("offline", {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
              })
            );
          }
        })()
      );
      return;
    }

    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          const pathname = new URL(url).pathname;
          const shouldCache = PRECACHE_URLS.some((p) => pathname.endsWith(p.replace("./", "").replace("../builder/", "")));
          if (shouldCache && res && res.ok) {
            cache.put(request, res.clone());
          }
          return res;
        } catch {
          return new Response("", { status: 504 });
        }
      })()
    );
  });
})();
