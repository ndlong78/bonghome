const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const adapter = read('js/games5-7-autosave.js');
const dashboard = read('js/parent-dashboard.js');
const serviceWorker = read('sw.js');

[
  'function comboFromElement(element)',
  "querySelector('path')",
  "path.getAttribute('d')",
  "path.getAttribute('fill')",
  "path.getAttribute('stroke')",
  '.map(comboFromElement).filter(Boolean)'
].forEach((snippet) => {
  assert.ok(adapter.includes(snippet), `Game 7 adapter must include: ${snippet}`);
});
assert.ok(!adapter.includes('function comboFromHtml'), 'Game 7 must not compare rendered HTML strings');

[
  'function renderGameSummary(container, byGame, games, catalog)',
  'Object.keys(inProgress)',
  'Đang chơi dở',
  'progress.byGame, progress.games, catalog',
  'Chưa có hoạt động nào được lưu'
].forEach((snippet) => {
  assert.ok(dashboard.includes(snippet), `Parent dashboard must include: ${snippet}`);
});

assert.match(
  serviceWorker,
  /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/,
  'Service Worker must use the standard version format'
);
assert.ok(serviceWorker.includes('./js/games5-7-autosave.js'), 'Game 7 restore adapter must remain cached offline');
assert.ok(serviceWorker.includes('./js/parent-dashboard.js'), 'Parent progress dashboard must remain cached offline');

console.log('Progress visibility regression checks passed.');
