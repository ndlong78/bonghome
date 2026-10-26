'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const routes = require(path.join(root, 'js', 'routes.js'));
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('normalizes supported Bông Home paths', () => {
  assert.equal(routes.normalizePathname('game1.html'), '/game1.html');
  assert.equal(routes.normalizePathname('/game1/'), '/game1');
  assert.equal(routes.normalizePathname('https://bong.no.id.vn/game1.html?source=test'), '/game1.html');
});

test('recognizes home, parents and collection with or without .html', () => {
  for (const pathname of ['/', '/index', '/index.html']) assert.equal(routes.isHome(pathname), true, pathname);
  for (const pathname of ['/parents', '/parents.html', '/parents/']) assert.equal(routes.isParentPage(pathname), true, pathname);
  for (const pathname of ['/collection', '/collection.html', '/collection/']) assert.equal(routes.isCollectionPage(pathname), true, pathname);
});

test('recognizes every existing game page and nothing else', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const gameIds = fs.readdirSync(path.resolve(__dirname, '..'))
    .map((name) => /^game(\d+)\.html$/.exec(name)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b);
  assert.deepEqual(gameIds, Array.from({ length: gameIds.length }, (_, index) => index + 1), 'gameN.html phải liên tục từ 1');
  for (const gameId of gameIds) {
    for (const pathname of [`/game${gameId}.html`, `/game${gameId}`, `/game${gameId}/`]) {
      assert.equal(routes.getGameId(pathname), gameId, pathname);
    }
  }
  assert.equal(routes.isGame(2, '/game2.html'), true);
  assert.equal(routes.isGame(12, '/game12'), true);
  assert.equal(routes.isGameInRange(2, 4, '/game3'), true);
  assert.equal(routes.isGameInRange(5, 7, '/game8.html'), false);
  assert.equal(routes.isGameInRange(11, 13, '/game13.html'), true);
  for (const pathname of ['/game0.html', `/game${gameIds.length + 1}`, '/game1-extra.html', '/games1.html']) {
    assert.equal(routes.getGameId(pathname), null, pathname);
  }
});

test('service worker precaches the routes module', () => {
  assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);
  assert.match(serviceWorker, /"\.\/js\/routes\.js"/);
  assert.match(serviceWorker, /"\.\/pwa-quality\.js"/);
});
