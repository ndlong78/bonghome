const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPath = path.resolve(__dirname, '..');
const themesPath = path.join(rootPath, 'js/themes.js');
const themesSource = fs.readFileSync(themesPath, 'utf8');
const registry = JSON.parse(fs.readFileSync(path.join(rootPath, 'content/themes/index.json'), 'utf8'));

assert.doesNotThrow(() => new vm.Script(themesSource), 'themes.js phải parse được trong trình duyệt/Node');
assert.doesNotMatch(
  themesSource,
  /function createBongThemes\([^)]*=[^)]*\)\s*{\s*['"]use strict['"];/,
  'Không được đặt use strict trong function có default parameter'
);

const createThemes = require(themesPath);
const serviceWorker = fs.readFileSync(path.join(rootPath, 'sw.js'), 'utf8');

const memory = new Map();
const storage = {
  get(key, fallback) { return memory.has(key) ? JSON.parse(JSON.stringify(memory.get(key))) : fallback; },
  set(key, value) { memory.set(key, JSON.parse(JSON.stringify(value))); return value; }
};
const applied = new Map();
const fakeRoot = {
  document: {
    documentElement: {
      dataset: {},
      style: { setProperty(name, value) { applied.set(name, value); } }
    }
  },
  CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  dispatchEvent() {}
};
const themes = createThemes(storage, fakeRoot);

assert.equal(themes.schemaVersion, 1);
assert.ok(themes.validateRegistry(registry));
assert.equal(themes.validateRegistry({ ...registry, defaultThemeId: 'missing' }), null);
assert.deepEqual(themes.migratePreferences('bong-home'), { schemaVersion: 1, activeThemeId: 'bong-home' });
assert.deepEqual(themes.migratePreferences({ schemaVersion: 99 }), { schemaVersion: 1, activeThemeId: null });

(async () => {
  await themes.init(async () => ({ ok: true, json: async () => registry }));
  assert.equal(themes.getActiveTheme().id, 'bong-home');
  assert.equal(themes.listThemes().length, registry.themes.filter((theme) => theme.available).length);
  ['animals', 'fruits', 'school'].forEach((themeId) => {
    assert.ok(themes.listThemes().some((theme) => theme.id === themeId));
  });
  assert.equal(fakeRoot.document.documentElement.dataset.theme, 'bong-home');
  assert.equal(applied.get('--bh-theme-primary'), '#C9B6F5');
  themes.setActiveTheme('animals');
  assert.equal(themes.getActiveTheme().id, 'animals');
  assert.equal(applied.get('--bh-theme-primary'), '#B9D89C');
  assert.throws(() => themes.setActiveTheme('missing'), RangeError);
  assert.equal(memory.get('themes').schemaVersion, 1);

  // shared-ui.js nạp và khởi động chủ đề, chuyển cho Game 1: e2e/shared-startup.spec.js.
  assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);
  assert.ok(serviceWorker.includes('./content/themes/index.json'));
  assert.ok(serviceWorker.includes('./css/themes.css'));
  // Tên màu cũ của game (--kem, --chu, --tim) đi theo chủ đề đang chọn: e2e/shared-styles.spec.js.

  console.log('Theme system checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
