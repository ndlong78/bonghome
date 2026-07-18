/* BÔNG HOME'S - Service Worker */
const PHIEN_BAN = "__CACHE_VERSION__";
const DANH_SACH_LUU = [
  "./", "./index.html", "./parent.html",
  "./game1.html", "./game2.html", "./game3.html", "./game4.html", "./game5.html", "./game6.html", "./game7.html", "./game8.html", "./game9.html", "./game10.html",
  "./shared-ui.js", "./common.css", "./design-system.css", "./components.js", "./audio.js", "./storage.js", "./celebration.js", "./phase2-app.js",
  "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./version.json"
];

async function baoChoTatCa(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach((client) => client.postMessage(message));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PHIEN_BAN);
    const results = await Promise.allSettled(DANH_SACH_LUU.map(async (url) => {
      const response = await fetch(new Request(url, { cache: "reload" }));
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      await cache.put(url, response);
      return url;
    }));
    const failed = results.map((result, index) => result.status === "rejected" ? DANH_SACH_LUU[index] : null).filter(Boolean);
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
    await Promise.all(names.filter((name) => name.startsWith('bonghome-') && name !== PHIEN_BAN).map((name) => caches.delete(name)));
    await self.clients.claim();
    await baoChoTatCa({ type: "CACHE_READY", version: PHIEN_BAN });
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response?.ok && response.type === "basic") {
        const cache = await caches.open(PHIEN_BAN);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      if (event.request.mode === "navigate") return caches.match("./index.html");
      return new Response("", { status: 503, statusText: "Không có mạng" });
    }
  })());
});
