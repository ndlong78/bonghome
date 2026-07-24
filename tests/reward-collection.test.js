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
  assert.equal(rewardCatalog.stickers.length, 10);
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

test('home profile UI links to the child collection page', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'profile-ui.js'), 'utf8');
  assert.match(source, /\.\/collection\.html/);
  assert.match(source, /Bộ sưu tập của Bông/);
});

test('collection page uses shared modules and reduced-motion support', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'collection.html'), 'utf8');
  assert.match(html, /shared-ui\.js/);
  assert.match(html, /reward-collection\.js/);
  assert.match(html, /collectionAvatar/);
  assert.match(html, /collectionTitle/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /aria-live="polite"/);
});
