const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const createStorage = require('../js/storage.js');
const createProfile = require('../js/profile.js');
const createProfileUI = require('../js/profile-ui.js');
const catalog = JSON.parse(read('content/profile/avatars.json'));
const sharedUi = read('shared-ui.js');
const serviceWorker = read('sw.js');
const css = read('css/profile.css');

const memoryStorage = (() => {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value))
  };
})();

const storage = createStorage(memoryStorage);
storage.migrate();
const profile = createProfile(storage);

assert.deepEqual(profile.migrate(), { schemaVersion: 1, displayName: 'Bông', avatarId: 'flower' });
assert.equal(profile.schemaVersion, 1);
assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.defaultAvatarId, 'flower');
assert.equal(catalog.avatars.length, 6);
assert.equal(new Set(catalog.avatars.map((item) => item.id)).size, catalog.avatars.length);

let saved = profile.updateProfile({ displayName: '  Bé   Bông  ', avatarId: 'rainbow' });
assert.equal(saved.displayName, 'Bé Bông');
assert.equal(saved.avatarId, 'rainbow');
assert.deepEqual(profile.getProfile(), saved);

saved = profile.updateProfile({ displayName: '\u0000'.repeat(3), avatarId: '../photo' });
assert.equal(saved.displayName, 'Bông');
assert.equal(saved.avatarId, 'flower');
assert.ok(profile.updateProfile({ displayName: 'A'.repeat(30) }).displayName.length <= 20);
assert.throws(() => profile.saveProfile({ schemaVersion: 99 }), /Unsupported profile schema/);

const profileUi = createProfileUI(profile, null);
assert.equal(profileUi.isHomePage('/'), true);
assert.equal(profileUi.isHomePage('/bonghome/'), true);
assert.equal(profileUi.isHomePage('/bonghome/index.html'), true);
assert.equal(profileUi.isHomePage('/bonghome/game1.html'), false);

assert.ok(sharedUi.includes('./js/profile.js'));
assert.ok(sharedUi.includes('./js/profile-ui.js'));
assert.ok(sharedUi.includes('./css/profile.css'));
assert.ok(sharedUi.includes('window.BongProfile?.migrate()'));
assert.ok(serviceWorker.includes('./content/profile/avatars.json'));
assert.ok(serviceWorker.includes('./js/profile.js'));
assert.ok(serviceWorker.includes('./js/profile-ui.js'));
assert.ok(serviceWorker.includes('./css/profile.css'));
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);
assert.match(css, /min-height:var\(--bh-touch-target,44px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /safe-area-inset/);

console.log('Local profile checks passed.');
