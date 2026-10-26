'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const createRewardCollection = require('../js/reward-collection.js');

function element(tagName) {
  return {
    tagName,
    className: '',
    textContent: '',
    attributes: {},
    children: [],
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; }
  };
}

function fakeDocument() {
  const nodes = {
    collectionTitle: element('h1'),
    collectionIntro: element('p'),
    collectionAvatar: element('div'),
    collectionStars: element('div'),
    collectionStickers: element('div'),
    collectionBadges: element('div')
  };
  return {
    title: 'Bộ sưu tập của Bông',
    nodes,
    createElement: element,
    getElementById(id) { return nodes[id] || null; }
  };
}

test('catalog validation accepts checked-in reward and avatar catalogs', () => {
  const rewardCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'rewards', 'catalog.json'), 'utf8'));
  const avatarCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'profile', 'avatars.json'), 'utf8'));
  const api = createRewardCollection({});
  assert.equal(api.normalizeCatalog(rewardCatalog), rewardCatalog);
  assert.equal(api.normalizeAvatarCatalog(avatarCatalog), avatarCatalog);
  assert.equal(rewardCatalog.stickers.length, 13);
  assert.ok(rewardCatalog.stickers.some((item) => item.id === 'wise-owl'));
  assert.ok(rewardCatalog.badges.some((item) => item.id === 'sudoku-master'));
  assert.ok(rewardCatalog.badges.length >= 5);
  assert.ok(avatarCatalog.avatars.length >= 1);
});

test('collection renders unlocked and locked rewards without writing data', () => {
  const api = createRewardCollection({});
  const document = fakeDocument();
  const catalog = {
    schemaVersion: 1,
    stickers: [
      { id: 'happy-star', name: 'Ngôi sao vui vẻ', icon: '🌟' },
      { id: 'little-flower', name: 'Bông hoa nhỏ', icon: '🌼' }
    ],
    badges: [{ id: 'first-finish', name: 'Lần đầu hoàn thành', icon: '🎈' }]
  };

  assert.equal(api.render(document, catalog, {
    stars: 7,
    stickerIds: ['happy-star'],
    badgeIds: []
  }), true);

  assert.equal(document.nodes.collectionStars.textContent, '⭐ Bé đã nhận 7 sao');
  assert.equal(document.nodes.collectionStickers.children.length, 2);
  assert.equal(document.nodes.collectionStickers.children[0].attributes['aria-disabled'], 'false');
  assert.equal(document.nodes.collectionStickers.children[1].attributes['aria-disabled'], 'true');
  assert.equal(document.nodes.collectionBadges.children[0].attributes['aria-disabled'], 'true');
});

test('collection uses local profile name and avatar', () => {
  const api = createRewardCollection({});
  const document = fakeDocument();
  const avatars = {
    schemaVersion: 1,
    defaultAvatarId: 'flower',
    avatars: [
      { id: 'flower', name: 'Bông hoa', icon: '🌸' },
      { id: 'rainbow', name: 'Cầu vồng', icon: '🌈' }
    ]
  };

  assert.equal(api.renderProfile(document, { displayName: 'Mít', avatarId: 'rainbow' }, avatars), true);
  assert.equal(document.nodes.collectionTitle.textContent, 'Bộ sưu tập của Mít');
  assert.equal(document.nodes.collectionIntro.textContent, 'Mỗi phần thưởng là một lời khen nhẹ nhàng dành cho Mít.');
  assert.equal(document.nodes.collectionAvatar.textContent, '🌈');
  assert.equal(document.title, 'Bộ sưu tập của Mít');
});

// Trang chủ có lối vào bộ sưu tập: e2e/parent-dashboard.spec.js.

// Trang bộ sưu tập: vùng nội dung chính có tên, avatar, số sao đọc qua live region (e2e/page-structure.spec.js);
// module nạp đúng (e2e/page-modules.spec.js); giảm chuyển động (e2e/reduced-motion-all-pages.spec.js).
