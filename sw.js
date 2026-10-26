/* BÔNG HOME'S - Service Worker */
const PHIEN_BAN = "bonghome-v91-game-shell-css";
const TEN_CACHE = Object.freeze({
  shell: `${PHIEN_BAN}-shell`,
  games: `${PHIEN_BAN}-games`,
  content: `${PHIEN_BAN}-content`,
  runtime: `${PHIEN_BAN}-runtime`
});

const TEP_SHELL = [
  "./", "./index.html", "./parents.html", "./collection.html",
  "./shared-ui.js", "./pwa-ios.js", "./pwa-quality.js",
  "./js/routes.js", "./js/storage.js", "./js/themes.js", "./js/theme-picker.js", "./js/progress.js", "./js/rewards.js", "./js/profile.js", "./js/profile-ui.js", "./js/statistics.js", "./js/game-catalog.js", "./js/parent-dashboard.js", "./js/parent-data-controls.js", "./js/daily-journey.js", "./js/reward-collection.js", "./js/game11-home-card.js", "./js/game12-home-card.js", "./js/game13-home-card.js",
  "./css/design-tokens.css", "./css/themes.css", "./css/theme-picker.css", "./css/common.css", "./css/components.css", "./css/daily-journey.css", "./css/profile.css", "./css/parent-dashboard.css",
  "./manifest.json", "./favicon.ico", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"
];

const TEP_GAME = [
  "./game1.html", "./game2.html", "./game3.html", "./game4.html", "./game5.html", "./game6.html", "./game7.html", "./game8.html", "./game9.html", "./game10.html", "./game11.html", "./game12.html", "./game13.html",
  "./game1-difficulty.js", "./game1-autosave.js",
  "./js/game1-rewards.js", "./js/game1-theme-progress.js", "./js/game1-content.js", "./js/game1-keyboard-accessibility.js", "./js/game1-engine.js", "./js/game1-ui.js", "./js/game2-keyboard-cursor.js", "./js/game2-engine.js", "./js/game2-ui.js", "./js/game3-keyboard-matching.js", "./js/game3-drag-stability.js", "./js/game3-engine.js", "./js/game3-ui.js", "./js/game4-keyboard-sorting.js", "./js/game4-engine.js", "./js/game4-ui.js", "./js/game5-touch-target.js", "./js/game5-engine.js", "./js/game5-ui.js", "./js/game6-engine.js", "./js/game6-ui.js", "./js/game7-engine.js", "./js/game7-ui.js", "./js/game8-engine.js", "./js/game8-ui.js", "./js/game9-engine.js", "./js/game9-ui.js", "./js/game10-engine.js", "./js/game10-ui.js", "./js/games2-4-rewards.js", "./js/games2-4-autosave.js", "./js/games5-7-rewards.js", "./js/games5-7-autosave.js", "./js/games8-10-rewards.js", "./js/games8-10-autosave.js", "./js/game11-blocks.js", "./js/game11-rewards.js", "./js/game12-sudoku.js", "./js/game13-rewards.js", "./js/game13-tictactoe.js", "./js/game12-rewards.js",
  "./css/game1-autosave.css", "./css/games-autosave.css", "./css/game11-blocks.css", "./css/game12-sudoku.css", "./css/game13-tictactoe.css"
];

const TEP_NOI_DUNG = [
  "./content/games/index.json", "./content/games/game1.json", "./content/games/game11.json", "./content/games/game12.json", "./content/games/game13.json", "./content/themes/animals/game1.json", "./content/themes/fruits/game1.json", "./content/themes/school/game1.json", "./content/themes/index.json", "./content/daily/index.json", "./content/rewards/catalog.json", "./content/profile/avatars.json"
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

/* Mạng chập chờn ("lie-fi") có thể treo rất lâu: quá thời gian này thì mở bản trong máy. */
const NAVIGATION_TIMEOUT_MS = 3000;

/* Khóa cache cho trang: bỏ query/hash để /game1.html?x=1 dùng chung một bản, cache không phình. */
function navigationCacheKey(request) {
  const url = new URL(request.url);
  return `${url.origin}${url.pathname}`;
}

async function cachedNavigation(request) {
  return (await caches.match(request, { ignoreSearch: true }))
    || (await caches.match(navigationCacheKey(request)));
}

function waitFor(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function networkFirstNavigation(event) {
  const { request } = event;
  const network = fetch(request).then(async (response) => {
    if (response?.ok && response.type === "basic") {
      const cache = await caches.open(TEN_CACHE.runtime);
      await cache.put(navigationCacheKey(request), response.clone());
    }
    return response;
  });
  // Mạng về muộn vẫn được cập nhật vào cache cho lần mở sau.
  event.waitUntil(network.catch(() => null));

  return (async () => {
    const fast = await waitFor(network.catch(() => null), NAVIGATION_TIMEOUT_MS);
    // Máy chủ lỗi 5xx thì bản trong máy vẫn tốt hơn trang lỗi.
    if (fast && fast.status < 500) return fast;
    const cached = await cachedNavigation(request);
    if (cached) return cached;
    if (fast) return fast;
    // Chưa có bản trong máy: chờ mạng thêm, hỏng hẳn thì về trang chủ đã lưu.
    const late = await network.catch(() => null);
    return late || (await caches.match("./index.html")) || Response.error();
  })();
}

/* Đường dẫn đã precache (không kèm query): phục vụ thẳng từ cache, không gọi mạng.
   Chúng chỉ đổi khi đổi PHIEN_BAN, nên tải lại mỗi lần chỉ tốn data mà không bao giờ được dùng. */
const DUONG_DAN_PRECACHE = new Set(
  NHOM_PRECACHE.flatMap((group) => group.urls).map((url) => new URL(url, self.location.href).pathname)
);
const SO_MUC_RUNTIME_TOI_DA = 60;

async function catBotRuntime(cache) {
  const keys = await cache.keys();
  const thua = keys.length - SO_MUC_RUNTIME_TOI_DA;
  if (thua > 0) await Promise.all(keys.slice(0, thua).map((key) => cache.delete(key)));
}

async function luuRuntime(request, response) {
  if (!response?.ok || response.type !== "basic") return;
  const cache = await caches.open(TEN_CACHE.runtime);
  await cache.put(request, response.clone());
  await catBotRuntime(cache);
}

async function cacheFirstPrecache(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  // Precache thiếu tệp (hiếm): lấy mạng và giữ lại cho lần sau.
  const response = await fetch(request);
  await luuRuntime(request, response);
  return response;
}

function staleWhileRevalidate(event) {
  const { request } = event;
  const network = fetch(request).then(async (response) => {
    await luuRuntime(request, response);
    return response;
  }).catch(() => null);
  // Gọi waitUntil đồng bộ trong lúc dispatch sự kiện; cache được đọc song song với mạng.
  event.waitUntil(network);
  return (async () => (await caches.match(request)) || (await network)
    || new Response("", { status: 503, statusText: "Không có mạng" }))();
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Tài nguyên ngoài origin: để trình duyệt tự xử lý, không đưa vào cache của app.
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event));
    return;
  }
  if (DUONG_DAN_PRECACHE.has(url.pathname)) {
    event.respondWith(cacheFirstPrecache(event.request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});
