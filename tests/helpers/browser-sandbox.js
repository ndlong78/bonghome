'use strict';

/*
 * Chạy một module trình duyệt (IIFE gắn vào window) thật trong node:vm với DOM tối giản,
 * hẹn giờ giả và MutationObserver giả, để test hành vi thay cho so chuỗi mã nguồn.
 *
 * Sandbox chỉ có đúng các biến toàn cục khai báo ở đây: module đọc một biến toàn cục cũ của trang
 * (ví dụ `giay`, `KHO_HINH`) sẽ ném ReferenceError, và lỗi đó được ghi vào `errors`.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');

class FakeEvents {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener));
  }
  dispatch(type, event = {}) {
    (this.listeners.get(type) || []).slice().forEach((listener) => listener({ type, target: this, ...event }));
  }
}

function createDom() {
  const observers = [];
  const byId = new Map();
  const bySelector = new Map();

  class FakeElement extends FakeEvents {
    constructor(tagName = 'div') {
      super();
      this.tagName = tagName.toUpperCase();
      this.attributes = new Map();
      this.children = [];
      this.textContent = '';
      this.hidden = false;
      const element = this;
      const classes = new Set();
      const changed = () => observers
        .filter((observer) => observer.target === element)
        .forEach((observer) => observer.callback([{ type: 'attributes', attributeName: 'class', target: element }]));
      this.classList = {
        add: (...names) => { names.forEach((name) => classes.add(name)); changed(); },
        remove: (...names) => { names.forEach((name) => classes.delete(name)); changed(); },
        toggle: (name, force) => {
          const on = force === undefined ? !classes.has(name) : Boolean(force);
          if (on) classes.add(name); else classes.delete(name);
          changed();
          return on;
        },
        contains: (name) => classes.has(name)
      };
    }
    get id() { return this.attributes.get('id') || ''; }
    set id(value) { this.setAttribute('id', value); }
    get className() { return this.attributes.get('class') || ''; }
    set className(value) { this.attributes.set('class', value); }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === 'id') byId.set(String(value), this);
    }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    appendChild(child) {
      this.children.push(child);
      if (child.id) byId.set(child.id, child);
      return child;
    }
    replaceChildren(...children) { this.children = children; }
    click() { this.dispatch('click'); }
  }

  const document = new FakeEvents();
  Object.assign(document, {
    visibilityState: 'visible',
    body: new FakeElement('body'),
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => byId.get(id) || null,
    querySelector: (selector) => query(selector)[0] || null,
    querySelectorAll: (selector) => query(selector)
  });

  // Hỗ trợ đủ cho các module: '#id', danh sách '#a, #b', và bộ chọn đã đăng ký bằng addSelector.
  function query(selector) {
    if (bySelector.has(selector)) return [bySelector.get(selector)];
    return selector.split(',').map((part) => part.trim())
      .map((part) => (/^#[\w-]+$/.test(part) ? byId.get(part.slice(1)) : bySelector.get(part)))
      .filter(Boolean);
  }

  /** Tạo phần tử có id sẵn trên trang (ví dụ #manThang, #nutVanMoi). */
  function addElement(id, tagName = 'div') {
    const element = new FakeElement(tagName);
    element.id = id;
    document.body.appendChild(element);
    return element;
  }
  /** Gắn phần tử cho một bộ chọn CSS mà module dùng với querySelector. */
  function addSelector(selector, element = new FakeElement()) {
    bySelector.set(selector, element);
    return element;
  }

  class MutationObserver {
    constructor(callback) { this.callback = callback; }
    observe(target) { this.target = target; observers.push(this); }
    disconnect() { observers.splice(observers.indexOf(this), 1); }
  }

  return { document, addElement, addSelector, MutationObserver, FakeElement };
}

function createClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  const schedule = (fn, delay, repeat) => {
    const id = nextId++;
    timers.set(id, { fn, at: now + Math.max(0, delay || 0), every: repeat ? Math.max(1, delay || 0) : 0 });
    return id;
  };
  return {
    setTimeout: (fn, delay) => schedule(fn, delay, false),
    setInterval: (fn, delay) => schedule(fn, delay, true),
    clearTimeout: (id) => timers.delete(id),
    clearInterval: (id) => timers.delete(id),
    /** Cho thời gian trôi `ms` mili giây, chạy các hẹn giờ đến hạn theo thứ tự. */
    tick(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, timer] = due;
        now = timer.at;
        if (timer.every) timer.at += timer.every; else timers.delete(id);
        timer.fn();
      }
      now = end;
    },
    pending: () => timers.size
  };
}

/**
 * Chạy `file` (đường dẫn tính từ gốc repo) trong sandbox.
 * `setup({ window, document, addElement, addSelector })` chạy trước module để dựng trang và API giả.
 * `modules` là giá trị mà window.BongModulesReady trả về.
 */
async function runBrowserModule(file, { pathname = '/', routes, modules = {}, setup } = {}) {
  const dom = createDom();
  const clock = createClock();
  const errors = [];
  const window = new FakeEvents();
  Object.assign(window, {
    location: { pathname },
    BongRoutes: routes,
    BongModulesReady: Promise.resolve(modules)
  });
  setup?.({ window, ...dom });
  const context = {
    window,
    document: dom.document,
    MutationObserver: dom.MutationObserver,
    console: { ...console, error: (...args) => errors.push(args), warn: (...args) => errors.push(args) },
    Date,
    Math,
    JSON,
    Promise,
    queueMicrotask,
    setTimeout: clock.setTimeout,
    setInterval: clock.setInterval,
    clearTimeout: clock.clearTimeout,
    clearInterval: clock.clearInterval
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  // Chờ BongModulesReady.then(init) chạy xong.
  await new Promise((resolve) => setImmediate(resolve));
  return { window, document: dom.document, clock, errors, ...dom };
}

// Object tạo trong vm có prototype của realm khác: sao chép qua JSON để so sánh bằng deepStrictEqual được.
const plain = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/** progress giả ghi lại mọi lệnh gọi (bản sao JSON); `saved` là bản lưu loadGame trả về. */
function createFakeProgress(saved = null) {
  const calls = { save: [], load: [], complete: [] };
  const seen = new Set();
  return {
    calls,
    loadGame(gameId) { calls.load.push(gameId); return saved; },
    saveGame(gameId, record) { calls.save.push({ gameId, record: plain(record) }); return record; },
    completeGame(gameId, result) {
      calls.complete.push({ gameId, result: plain(result) });
      const duplicate = seen.has(result.transactionId);
      seen.add(result.transactionId);
      return { duplicate };
    }
  };
}

/** API window.BongGameN giả cho adapter autosave; `state` điều khiển các giá trị trả về. */
function createFakeGame(state = {}) {
  const game = {
    calls: { serialize: [], restore: [] },
    state: { moves: 3, seconds: 42, canSave: true, restoreOk: true, difficulty: 'easy', ...state },
    serialize(sessionId) { game.calls.serialize.push(sessionId); return { sessionId, marker: 'snapshot' }; },
    restore(saved) { game.calls.restore.push(plain(saved)); return game.state.restoreOk; },
    moves: () => game.state.moves,
    seconds: () => game.state.seconds,
    canSave: () => game.state.canSave,
    difficulty: () => game.state.difficulty
  };
  return game;
}

module.exports = { runBrowserModule, createFakeProgress, createFakeGame, plain, root };
