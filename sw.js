/* BÔNG HOME'S - Service Worker */
const PHIEN_BAN = "bonghome-v33-root-favicon";
const TEN_CACHE = Object.freeze({
  shell: `${PHIEN_BAN}-shell`,
  games: `${PHIEN_BAN}-games`,
  content: `${PHIEN_BAN}-content`,
  runtime: `${PHIEN_BAN}-runtime`
});

const TEP_SHELL = [
  "./", "./index.html", "./parents.html",
  "./shared-ui.js", "./pwa-ios.js", "./pwa-quality.js",
  "./js/storage.js", "./js/themes.js", "./js/theme-picker.js", "./js/progress.js", "./js/rewards.js", "./js/profile.js", "./js/profile-ui.js", "./js/statistics.js", "./js/parent-dashboard.js", "./js/daily-journey.js",
  "./css/design-tokens.css", "./css/themes.css", "./css/theme-picker.css", "./css/common.css", "./css/components.css", "./css/daily-journey.css", "./css/profile.css", "./css/parent-dashboard.css",
  "./manifest.json", "./favicon.ico", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"
];

const TEP_GAME = [
  "./game1.html", "./game2.html", "./game3.html", "./game4.html", "./game5.html", "./game6.html", "./game7.html", "./game8.html", "./game9.html", "./game10.html",
  "./game1-difficulty.js", "./game1-autosave.js",
  "./js/game1-rewards.js", "./js/game1-theme-progress.js", "./js/game1-content.js", "./js/games2-4-autosave.js", "./js/games5-7-autosave.js", "./js/games8-10-autosave.js",
  "./css/game1-autosave.css", "./css/games-autosave.css"
];

const TEP_NOI_DUNG = [
  "./content/games/game1.json", "./content/themes/animals/game1.json", "./content/themes/fruits/game1.json", "./content/themes/school/game1.json", "./content/themes/index.json", "./content/daily/index.json", "./content/rewards/catalog.json", "./content/profile/avatars.json"
];

const NHOM_PRECACHE = Object.freeze([
  { cacheName: TEN_CACHE.shell, urls: TEP_SHELL },
  { cacheName: TEN_CACHE.games, urls: TEP_GAME },
  { cacheName: TEN_CACHE.content, urls: TEP_NOI_DUNG }
]);

async function baoChoTatCa(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach((client) => client.postMessage(message));
}

async function luuNhom(cacheName, urls) {
  const cache = await caches.open(cacheName);
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(new Request(url, { cache: "reload" }));
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      await cache.put(url, response);
      return url;
    })
  );
  return results
    .map((result, index) => result.status === "rejected" ? urls[index] : null)
    .filter(Boolean);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const failures = await Promise.all(
      NHOM_PRECACHE.map((group) => luuNhom(group.cacheName, group.urls))
    );
    const failed = failures.flat();
    if (failed.length) {
      await Promise.all(Object.values(TEN_CACHE).map((name) => caches.delete(name)));
      await baoChoTatCa({ type: "CACHE_FAILED", failed, version: PHIEN_BAN });
      throw new Error(`Không tải đủ tệp offline: ${failed.join(', ')}`);
    }
    await baoChoTatCa({ type: "UPDATE_READY", version: PHIEN_BAN });
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const currentCaches = new Set(Object.values(TEN_CACHE));
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith("bonghome-") && !currentCaches.has(name))
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
    await baoChoTatCa({ type: "CACHE_READY", version: PHIEN_BAN });
  })());
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response?.ok) {
      const cache = await caches.open(TEN_CACHE.runtime);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match("./index.html"));
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then(async (response) => {
    if (response?.ok && response.type === "basic") {
      const cache = await caches.open(TEN_CACHE.runtime);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || (await network) || new Response("", { status: 503, statusText: "Không có mạng" });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event.request));
});
