const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const registry = JSON.parse(read('content/themes/index.json'));
const animals = JSON.parse(read('content/games/game1-animals.json'));
const createAdapter = require('../js/game1-theme-progress.js');
const themePicker = require('../js/theme-picker.js');
const sharedUi = read('shared-ui.js');
const pickerSource = read('js/theme-picker.js');
const pickerCss = read('css/theme-picker.css');
const serviceWorker = read('sw.js');

assert.ok(registry.themes.some((theme) => theme.id === 'animals' && theme.available));
assert.equal(animals.themeId, 'animals');
assert.equal(animals.cards.length, 12);
assert.equal(new Set(animals.cards.map((card) => card.id)).size, 12);
assert.ok(animals.cards.every((card) => card.svg.startsWith('<svg')));

assert.equal(themePicker.isSupportedPage('/'), true);
assert.equal(themePicker.isSupportedPage('/index.html'), true);
assert.equal(themePicker.isSupportedPage('/bonghome/'), true, 'GitHub Pages project root phải hiển thị theme picker');
assert.equal(themePicker.isSupportedPage('/bonghome/index.html'), true, 'GitHub Pages index phải hiển thị theme picker');
assert.equal(themePicker.isSupportedPage('/bonghome/game1.html'), true);
assert.equal(themePicker.isSupportedPage('/bonghome/game2.html'), false);

let currentTheme = 'bong-home';
let saved = null;
const completions = [];
const baseProgress = {
  schemaVersion: 1,
  saveGame(gameId, state) {
    saved = {
      status: state.status || 'in_progress',
      difficulty: state.difficulty || null,
      theme: state.theme || null,
      state: JSON.parse(JSON.stringify(state.state || {})),
      startedAt: state.startedAt || '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:01.000Z'
    };
    return JSON.parse(JSON.stringify(saved));
  },
  loadGame() { return saved ? JSON.parse(JSON.stringify(saved)) : null; },
  clearGame() { const existed = Boolean(saved); saved = null; return existed; },
  completeGame(gameId, result) { completions.push(JSON.parse(JSON.stringify(result))); saved = null; return { duplicate: false, completion: result }; },
  getSummary() { return {}; }
};
const themes = { getActiveTheme: () => ({ id: currentTheme }) };
const progress = createAdapter(baseProgress, themes);

const homeState = { bundleVersion: 1, activeDifficulty: 3, snapshots: { 3: { snapshot: { difficulty: 3 }, startedAt: 'home' } } };
const animalState = { bundleVersion: 1, activeDifficulty: 6, snapshots: { 6: { snapshot: { difficulty: 6 }, startedAt: 'animals' } } };

progress.saveGame('game1', { difficulty: '3', state: homeState, startedAt: 'home-start' });
currentTheme = 'animals';
assert.equal(progress.loadGame('game1'), null, 'Theme mới không được nhìn thấy ván của theme cũ');
progress.saveGame('game1', { difficulty: '6', state: animalState, startedAt: 'animal-start' });
assert.deepEqual(progress.loadGame('game1').state, animalState);
currentTheme = 'bong-home';
assert.deepEqual(progress.loadGame('game1').state, homeState, 'Quay lại theme cũ phải còn nguyên ván');

currentTheme = 'animals';
progress.completeGame('game1', { transactionId: 'game1:6:animal-start', metadata: {} });
assert.equal(completions[0].transactionId, 'animals:game1:6:animal-start');
assert.equal(completions[0].metadata.themeId, 'animals');
currentTheme = 'bong-home';
assert.deepEqual(progress.loadGame('game1').state, homeState, 'Hoàn thành theme động vật không được xóa ván theme mặc định');

assert.match(sharedUi, /game1-theme-progress\.js/);
assert.match(sharedUi, /theme-picker\.js/);
assert.match(pickerSource, /bonghome:pause/);
assert.match(pickerSource, /location\.reload\(\)/);
assert.match(pickerCss, /min-height:44px/);
assert.match(pickerCss, /prefers-reduced-motion/);
assert.ok(serviceWorker.includes('./content/games/game1-animals.json'));
assert.ok(serviceWorker.includes('./js/game1-theme-progress.js'));
assert.ok(serviceWorker.includes('./js/theme-picker.js'));
assert.ok(serviceWorker.includes('./css/theme-picker.css'));
assert.match(serviceWorker, /bonghome-v16-theme-picker-path/);

console.log('Animal theme checks passed.');