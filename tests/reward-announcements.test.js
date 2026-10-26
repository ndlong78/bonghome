'use strict';

/*
 * Cách bốn lớp phần thưởng (game1, games2-4, games5-7, games8-10) báo phần thưởng, chạy thật completeGame với
 * DOM giả: có hộp thắng thì chèn tóm tắt vào trước nhóm nút, không có thì hiện thông báo nổi rồi tự ẩn.
 * Live region phải khai báo đủ role/aria-live/aria-atomic TRƯỚC khi chèn vào trang (chèn rồi mới khai báo thì
 * trình đọc màn hình có thể bỏ qua lần đọc đầu): DOM giả ghi lại thuộc tính đúng lúc chèn.
 * Thay cho các kiểm tra so chuỗi mã nguồn (reward-win-dialog, *-reward-live-region).
 */
const assert = require('node:assert/strict');

const LIVE_REGION = { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' };

class FakeElement {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.document = document;
    this.attributes = {};
    this.children = [];
    this.className = '';
    this.textContent = '';
    this.hidden = false;
    this.parent = null;
  }
  set id(value) { this.attributes.id = value; }
  get id() { return this.attributes.id || ''; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; }
  insertBefore(child, reference) {
    this.document.inserted.push({ element: child, parent: this, attributes: { ...child.attributes }, before: reference });
    const index = reference ? this.children.indexOf(reference) : -1;
    child.parent = this;
    if (index >= 0) this.children.splice(index, 0, child); else this.children.push(child);
    return child;
  }
  appendChild(child) { return this.insertBefore(child, null); }
  replaceChildren(...children) { this.children = children; }
  get text() { return this.children.map((child) => child.textContent).join('\n') || this.textContent; }
  /** Đủ cho các module: tìm con cháu theo một lớp ('.ten-lop'). */
  querySelector(selector) {
    const className = selector.replace(/^\./, '');
    for (const child of this.children) {
      if (child.className.split(/\s+/).includes(className)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
}

function createPage({ withDialog }) {
  const timers = [];
  const document = { inserted: [] };
  Object.assign(document, {
    body: new FakeElement('body', document),
    createElement: (tagName) => new FakeElement(tagName, document),
    getElementById: (id) => document.inserted.map((entry) => entry.element).find((element) => element.id === id) || null,
    querySelector: (selector) => (withDialog && /^(\.man-thang|#manThang) \.hop-thang$/.test(selector) ? dialog : null)
  });
  const dialog = new FakeElement('div', document);
  dialog.className = 'hop-thang';
  const actions = new FakeElement('div', document);
  actions.className = 'nhom-nut';
  dialog.children.push(actions);
  const root = {
    document,
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    clearTimeout: () => {},
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    events: [],
    dispatchEvent(event) { root.events.push(event); }
  };
  return { root, document, dialog, actions, timers };
}

function createModules() {
  const byGame = {};
  let stars = 0;
  const seen = new Set();
  const unlocked = new Set();
  return {
    progress: {
      schemaVersion: 1,
      saveGame() {}, loadGame() {}, clearGame() {},
      completeGame(gameId, result) {
        byGame[gameId] = (byGame[gameId] || 0) + 1;
        return { duplicate: false, completion: { gameId, transactionId: result.transactionId, difficulty: result.difficulty } };
      },
      getSummary: () => ({ byGame: { ...byGame } })
    },
    rewards: {
      awardStars(transactionId, amount) {
        const duplicate = seen.has(transactionId);
        if (!duplicate) { seen.add(transactionId); stars += amount; }
        return { duplicate, summary: { stars } };
      },
      unlockSticker(id) { const duplicate = unlocked.has(`s:${id}`); unlocked.add(`s:${id}`); return { duplicate }; },
      unlockBadge(id) { const duplicate = unlocked.has(`b:${id}`); unlocked.add(`b:${id}`); return { duplicate }; }
    }
  };
}

const MODULES = [
  { file: '../js/game1-rewards.js', gameId: 'game1', result: { difficulty: '6' }, stars: 2, summaryClass: 'bh-game1-reward-summary', statusId: 'bhGame1RewardStatus', hideAfter: 2800 },
  { file: '../js/games2-4-rewards.js', gameId: 'game3', result: {}, stars: 2, summaryClass: 'bh-reward-summary', statusId: 'bhGameRewardStatus', hideAfter: 3000 },
  { file: '../js/games5-7-rewards.js', gameId: 'game6', result: {}, stars: 2, summaryClass: 'bh-reward-summary', statusId: 'bhGameRewardStatus', hideAfter: 3000 },
  { file: '../js/games8-10-rewards.js', gameId: 'game9', result: {}, stars: 2, summaryClass: 'bh-reward-summary', statusId: 'bhGameRewardStatus', hideAfter: 3000 }
];

for (const config of MODULES) {
  const factory = require(config.file);
  const label = `${config.file} (${config.gameId})`;

  // Có hộp thắng: tóm tắt chèn vào trước nhóm nút, live region khai báo đủ trước khi chèn, chỉ một tóm tắt.
  {
    const page = createPage({ withDialog: true });
    const { progress, rewards } = createModules();
    const adapter = factory(progress, rewards, page.root);
    adapter.completeGame(config.gameId, { transactionId: `${config.gameId}-a`, ...config.result });

    const summaries = page.document.inserted.filter((entry) => entry.element.className === config.summaryClass);
    assert.equal(summaries.length, 1, `${label}: chèn đúng một tóm tắt`);
    const [summary] = summaries;
    assert.equal(summary.parent, page.dialog, label);
    assert.equal(summary.before, page.actions, `${label}: tóm tắt nằm trước nhóm nút`);
    for (const [name, value] of Object.entries(LIVE_REGION)) {
      assert.equal(summary.attributes[name], value, `${label}: ${name} phải có trước khi chèn`);
    }
    assert.equal(summary.element.hidden, false);
    assert.match(summary.element.text, new RegExp(`^⭐ Bé nhận ${config.stars} sao`), label);
    assert.ok(summary.element.children.length >= 2, `${label}: lần đầu có cả dòng mở khoá sticker/huy hiệu`);
    assert.equal(page.document.inserted.some((entry) => entry.element.id === config.statusId), false, `${label}: không hiện thông báo nổi`);

    // Ván sau: dùng lại tóm tắt cũ (không chèn thêm), chỉ còn dòng sao vì sticker/huy hiệu đã mở.
    adapter.completeGame(config.gameId, { transactionId: `${config.gameId}-b`, ...config.result });
    assert.equal(page.document.inserted.filter((entry) => entry.element.className === config.summaryClass).length, 1, label);
    assert.equal(summary.element.children.length, 1, `${label}: chỉ còn dòng sao`);
    assert.ok(page.root.events.every((event) => event.type === 'bonghome:reward'), label);
  }

  // Không có hộp thắng: thông báo nổi gắn vào body, live region khai báo đủ trước khi gắn, tự ẩn sau một lúc.
  {
    const page = createPage({ withDialog: false });
    const { progress, rewards } = createModules();
    factory(progress, rewards, page.root).completeGame(config.gameId, { transactionId: `${config.gameId}-c`, ...config.result });
    const status = page.document.inserted.find((entry) => entry.element.id === config.statusId);
    assert.ok(status, `${label}: có thông báo nổi`);
    assert.equal(status.parent, page.document.body, label);
    for (const [name, value] of Object.entries(LIVE_REGION)) {
      assert.equal(status.attributes[name], value, `${label}: ${name} phải có trước khi gắn vào body`);
    }
    assert.match(status.element.textContent, new RegExp(`^⭐ Bé nhận ${config.stars} sao · `), label);
    const hide = page.timers.find((timer) => timer.delay === config.hideAfter);
    assert.ok(hide, `${label}: hẹn giờ ẩn sau ${config.hideAfter} ms`);
    hide.fn();
    assert.equal(status.element.hidden, true, label);
  }
}

// Nội dung các dòng phần thưởng (sticker riêng của Game 1; huy hiệu riêng của từng nhóm game).
{
  const detail = { stars: 2, newSticker: true, stickerIcon: '🎁', stickerName: 'Bông hoa nhỏ', newBadge: true };
  const lines = (file) => require(file)(createModules().progress, createModules().rewards, null).rewardLines(detail);
  assert.deepEqual(lines('../js/game1-rewards.js'), ['⭐ Bé nhận 2 sao', '🌟 Sticker mới: Ngôi sao vui vẻ', '🎈 Huy hiệu mới: Lần đầu hoàn thành']);
  assert.deepEqual(lines('../js/games2-4-rewards.js'), ['⭐ Bé nhận 2 sao', '🎁 Sticker mới: Bông hoa nhỏ', '🔎 Huy hiệu mới: Bé ham khám phá']);
  assert.deepEqual(lines('../js/games5-7-rewards.js'), ['⭐ Bé nhận 2 sao', '🎁 Sticker mới: Bông hoa nhỏ', '🧠 Huy hiệu mới: Bé tư duy']);
  assert.deepEqual(lines('../js/games8-10-rewards.js'), ['⭐ Bé nhận 2 sao', '🎁 Sticker mới: Bông hoa nhỏ', '🏆 Huy hiệu mới: Bé chinh phục']);
  // Không có gì mới mở khoá thì chỉ còn dòng sao.
  assert.deepEqual(require('../js/games2-4-rewards.js')(createModules().progress, createModules().rewards, null).rewardLines({ stars: 2 }), ['⭐ Bé nhận 2 sao']);
}

console.log('Reward announcement checks passed.');
