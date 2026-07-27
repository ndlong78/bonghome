'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const routes = require(path.join(root, 'js', 'routes.js'));
const sharedUi = fs.readFileSync(path.join(root, 'shared-ui.js'), 'utf8');
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

test('recognizes only Game 1 through Game 10', () => {
  assert.equal(routes.getGameId('/game1.html'), 1);
  assert.equal(routes.getGameId('/game4'), 4);
  assert.equal(routes.getGameId('/game10/'), 10);
  assert.equal(routes.isGame(2, '/game2.html'), true);
  assert.equal(routes.isGameInRange(2, 4, '/game3'), true);
  assert.equal(routes.isGameInRange(5, 7, '/game8.html'), false);
  for (const pathname of ['/game0.html', '/game11', '/game1-extra.html', '/games1.html']) {
    assert.equal(routes.getGameId(pathname), null, pathname);
  }
});

test('shared UI waits for and uses the common route module', () => {
  assert.match(sharedUi, /loadSharedScript\('\.\/js\/routes\.js', 'data-bh-routes'\)/);
  assert.match(sharedUi, /window\.BongRoutesReady\.then\(\(\) => \{/);
  assert.match(sharedUi, /getRoutes\(\)\.isGameInRange\(2, 4\)/);
  assert.match(sharedUi, /getRoutes\(\)\.isHome\(\)/);
});

test('service worker precaches the routes module', () => {
  assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);
  assert.match(serviceWorker, /"\.\/js\/routes\.js"/);
});
