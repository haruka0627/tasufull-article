/* TASFUL Builder PWA — scope: builder/ only */

/* eslint-disable no-restricted-globals */
(function () {
  "use strict";

  const VERSION = "builder-v5";
  const CACHE_NAME = `tasful-${VERSION}`;
  const OFFLINE_URL = "./index.html";

  const PRECACHE_URLS = [
    "./index.html",
    "./builder.css",
    "./builder.js",
    "./manifest.json",
    "./icon.svg",
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
            .filter((key) => key.startsWith("tasful-") && key !== CACHE_NAME)
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

  function isNavigationRequest(request) {
    return request.mode === "navigate";
  }

  self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = request.url;

    // 外部通信や Supabase 等は無理に触らない（そのままネットワークへ）
    if (!isSameOrigin(url)) return;

    // SPAではないが、オフライン時の最低限として navigate は index.html を返す
    if (isNavigationRequest(request)) {
      event.respondWith(
        (async () => {
          try {
            const network = await fetch(request);
            return network;
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

    // JS/CSS/HTML は network-first（古い builder.js が残らないよう）
    const pathname = new URL(url).pathname;
    const isMutableAsset = /\.(js|css|html)$/i.test(pathname);

    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        if (isMutableAsset) {
          try {
            const res = await fetch(request);
            if (res && res.ok) {
              cache.put(request, res.clone());
            }
            return res;
          } catch {
            const cached = await cache.match(request);
            if (cached) return cached;
            return new Response("", { status: 504 });
          }
        }

        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const res = await fetch(request);
          const shouldCache = PRECACHE_URLS.some((p) => pathname.endsWith(p.replace("./", "")));
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
