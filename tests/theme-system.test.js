const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootPath = path.resolve(__dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(rootPath, 'content/themes/index.json'), 'utf8'));
const createThemes = require(path.join(rootPath, 'js/themes.js'));
const sharedUi = fs.readFileSync(path.join(rootPath, 'shared-ui.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(rootPath, 'sw.js'), 'utf8');
const css = fs.readFileSync(path.join(rootPath, 'css/themes.css'), 'utf8');

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
  assert.equal(themes.listThemes().length, 2);
  assert.ok(themes.listThemes().some((theme) => theme.id === 'animals'));
  assert.equal(fakeRoot.document.documentElement.dataset.theme, 'bong-home');
  assert.equal(applied.get('--bh-theme-primary'), '#C9B6F5');
  themes.setActiveTheme('animals');
  assert.equal(themes.getActiveTheme().id, 'animals');
  assert.equal(applied.get('--bh-theme-primary'), '#B9D89C');
  assert.throws(() => themes.setActiveTheme('missing'), RangeError);
  assert.equal(memory.get('themes').schemaVersion, 1);

  assert.match(sharedUi, /\.\/js\/themes\.js/);
  assert.match(sharedUi, /BongThemes\.init\(\)/);
  assert.match(sharedUi, /themes: window\.BongThemes/);
  assert.match(serviceWorker, /bonghome-v15-animal-theme/);
  assert.ok(serviceWorker.includes('./content/themes/index.json'));
  assert.ok(serviceWorker.includes('./css/themes.css'));
  assert.match(css, /--bh-theme-primary/);
  assert.match(css, /:root\[data-theme\]/);

  console.log('Theme system checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
