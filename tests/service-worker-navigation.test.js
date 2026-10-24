const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');
const ORIGIN = 'https://bong.test';

/** Nạp sw.js trong sandbox với caches/fetch giả lập; đồng hồ do test điều khiển. */
function loadWorker({ cached = {}, fetchImpl }) {
  const listeners = {};
  const store = new Map(Object.entries(cached));
  const timers = [];
  const keyOf = (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url, `${ORIGIN}/`);
    return options?.ignoreSearch ? `${url.origin}${url.pathname}` : url.href;
  };
  const caches = {
    async match(input, options) {
      const key = keyOf(input, options);
      for (const [stored, response] of store) {
        const candidate = options?.ignoreSearch ? keyOf(stored, options) : keyOf(stored);
        if (candidate === key) return response;
      }
      return undefined;
    },
    async open() {
      return { put: async (key, response) => { store.set(keyOf(key), response); } };
    },
    keys: async () => [],
    delete: async () => true
  };
  const context = {
    URL,
    Response,
    Promise,
    console,
    caches,
    fetch: fetchImpl,
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
    clearTimeout: () => {},
    self: {
      addEventListener: (type, listener) => { listeners[type] = listener; },
      clients: { matchAll: async () => [], claim: async () => {} },
      skipWaiting: () => {}
    }
  };
  vm.runInNewContext(source, context);
  return {
    store,
    fireTimers: () => timers.splice(0).forEach((callback) => callback()),
    navigate(url) {
      let responded;
      const waits = [];
      listeners.fetch({
        request: { method: 'GET', mode: 'navigate', url },
        respondWith: (promise) => { responded = promise; },
        waitUntil: (promise) => waits.push(promise)
      });
      return { responded, waits };
    }
  };
}

const page = (body) => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
const tick = () => new Promise((resolve) => setImmediate(resolve));

assert.match(source, /const NAVIGATION_TIMEOUT_MS = \d+;/);

(async () => {
  // Mạng chập chờn: quá thời gian chờ thì mở bản trong máy (bỏ qua query string).
  {
    const worker = loadWorker({
      cached: { [`${ORIGIN}/game1.html`]: page('cached-game1') },
      fetchImpl: () => new Promise(() => {})
    });
    const { responded } = worker.navigate(`${ORIGIN}/game1.html?from=home`);
    await tick();
    worker.fireTimers();
    const response = await responded;
    assert.equal(await response.text(), 'cached-game1');
  }

  // Mất mạng hẳn: trả bản trong máy ngay, không phải chờ hết thời gian.
  {
    const worker = loadWorker({
      cached: { [`${ORIGIN}/parents.html`]: page('cached-parents') },
      fetchImpl: () => Promise.reject(new TypeError('offline'))
    });
    const { responded } = worker.navigate(`${ORIGIN}/parents.html`);
    const response = await responded;
    assert.equal(await response.text(), 'cached-parents');
  }

  // Mạng tốt: trả bản mạng và lưu vào cache theo đường dẫn không kèm query.
  {
    const worker = loadWorker({ fetchImpl: async () => page('fresh') });
    Object.defineProperty(Response.prototype, 'type', { configurable: true, get: () => 'basic' });
    const { responded, waits } = worker.navigate(`${ORIGIN}/game2.html?utm=1`);
    assert.equal(await (await responded).text(), 'fresh');
    await Promise.all(waits);
    delete Response.prototype.type;
    assert.ok(worker.store.has(`${ORIGIN}/game2.html`), 'cache phải dùng khóa không có query');
    assert.equal(worker.store.has(`${ORIGIN}/game2.html?utm=1`), false);
  }

  // Chưa có bản trong máy và mạng chậm: tiếp tục chờ mạng thay vì trả lỗi.
  {
    let resolveFetch;
    const worker = loadWorker({ fetchImpl: () => new Promise((resolve) => { resolveFetch = resolve; }) });
    const { responded } = worker.navigate(`${ORIGIN}/game9.html`);
    await tick();
    worker.fireTimers();
    await tick();
    resolveFetch(page('late-network'));
    assert.equal(await (await responded).text(), 'late-network');
  }

  // Máy chủ lỗi 5xx: ưu tiên bản trong máy; không có bản nào thì vẫn trả phản hồi của máy chủ.
  {
    const worker = loadWorker({
      cached: { [`${ORIGIN}/game3.html`]: page('cached-game3') },
      fetchImpl: async () => new Response('down', { status: 503 })
    });
    assert.equal(await (await worker.navigate(`${ORIGIN}/game3.html`).responded).text(), 'cached-game3');

    const empty = loadWorker({ fetchImpl: async () => new Response('down', { status: 503 }) });
    assert.equal((await empty.navigate(`${ORIGIN}/game4.html`).responded).status, 503);
  }

  // Mất mạng và không có bản của trang: về trang chủ đã lưu.
  {
    const worker = loadWorker({
      cached: { [`${ORIGIN}/index.html`]: page('home') },
      fetchImpl: () => Promise.reject(new TypeError('offline'))
    });
    const { responded } = worker.navigate(`${ORIGIN}/game13.html`);
    assert.equal(await (await responded).text(), 'home');
  }

  console.log('Service Worker navigation checks passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
