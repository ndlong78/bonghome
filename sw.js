/* BÔNG HOME'S - Service Worker */
const PHIEN_BAN = "bonghome-v8-ios";
const DANH_SACH_LUU = [
  "./", "./index.html",
  "./game1.html", "./game2.html", "./game3.html", "./game4.html", "./game5.html", "./game6.html", "./game7.html", "./game8.html", "./game9.html", "./game10.html",
  "./shared-ui.js", "./pwa-ios.js", "./game1-difficulty.js", "./manifest.json", "./icon-192.png", "./icon-512.png",
  "./icon-maskable-512.png", "./apple-touch-icon.png"
];

async function baoChoTatCa(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach((client) => client.postMessage(message));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PHIEN_BAN);
    const results = await Promise.allSettled(
      DANH_SACH_LUU.map(async (url) => {
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
        await cache.put(url, response);
        return url;
      })
    );
    const failed = results
      .map((result, index) => result.status === "rejected" ? DANH_SACH_LUU[index] : null)
      .filter(Boolean);
    if (failed.length) {
      await caches.delete(PHIEN_BAN);
      await baoChoTatCa({ type: "CACHE_FAILED", failed, version: PHIEN_BAN });
      throw new Error(`Không tải đủ tệp offline: ${failed.join(', ')}`);
    }
    await baoChoTatCa({ type: "CACHE_READY", version: PHIEN_BAN });
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("bonghome-") && name !== PHIEN_BAN).map((name) => caches.delete(name)));
    await self.clients.claim();
    await baoChoTatCa({ type: "CACHE_READY", version: PHIEN_BAN });
  })());
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response?.ok) {
      const cache = await caches.open(PHIEN_BAN);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match("./index.html"));
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response?.ok && response.type === "basic") {
      const cache = await caches.open(PHIEN_BAN);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503, statusText: "Không có mạng" });
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }
  event.respondWith(cacheFirstAsset(event.request));
});
