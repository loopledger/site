// The capture app's service worker. On install it fetches the app shell (the page and every script, style and icon it
// names) into one cache; afterwards a request is answered from that cache first and from the network only when it is not
// there, so the app opens and runs a pilot event with no connection. A new cache name replaces the old one.
const CACHE = "loopledger-capture-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

/** Same-origin URLs the page refers to with `src` or `href`. */
const referenced = (html) => [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(?:[a-z]+:)?\/\//i.test(u));

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch("./index.html", { cache: "reload" });
      const html = await page.clone().text();
      await cache.put("./index.html", page);
      await cache.addAll([...new Set([...SHELL.filter((u) => u !== "./index.html"), ...referenced(html)])]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
        return response;
      } catch {
        // A navigation while offline opens the shell.
        if (request.mode === "navigate") return (await caches.match("./index.html")) ?? Response.error();
        return Response.error();
      }
    })(),
  );
});
