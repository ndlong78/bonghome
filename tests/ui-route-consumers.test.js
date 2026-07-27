'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const routes = require(path.join(root, 'js', 'routes.js'));
globalThis.BongRoutes = routes;

const themePicker = require(path.join(root, 'js', 'theme-picker.js'));
const createProfileUI = require(path.join(root, 'js', 'profile-ui.js'));
const parentDashboardSource = fs.readFileSync(path.join(root, 'js', 'parent-dashboard.js'), 'utf8');
const themePickerSource = fs.readFileSync(path.join(root, 'js', 'theme-picker.js'), 'utf8');
const profileSource = fs.readFileSync(path.join(root, 'js', 'profile-ui.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.equal(themePicker.isHomePage('/index'), true);
assert.equal(themePicker.isSupportedPage('/game1'), true);
assert.equal(themePicker.isSupportedPage('/game1/'), true);
assert.equal(themePicker.isSupportedPage('/game2'), false);

const profileUi = createProfileUI(null, { BongRoutes: routes });
assert.equal(profileUi.isHomePage('/index'), true);
assert.equal(profileUi.isHomePage('/index.html'), true);
assert.equal(profileUi.isHomePage('/game1'), false);

assert.match(themePickerSource, /BongRoutesReady/);
assert.match(themePickerSource, /getRoutes\(\)\.isGame\(1, root\.location\.pathname\)/);
assert.match(profileSource, /BongRoutes\?\.isHome/);
assert.match(parentDashboardSource, /BongRoutesReady/);
assert.match(parentDashboardSource, /getRoutes\(\)\.isParentPage\(pathname\)/);
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);
for (const asset of ['./js/theme-picker.js', './js/profile-ui.js', './js/parent-dashboard.js']) {
  assert.ok(serviceWorker.includes(asset), `${asset} must stay cached offline`);
}

delete globalThis.BongRoutes;
console.log('Shared route consumers checks passed.');
