const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const adapter = read('js/games5-7-autosave.js');
const dashboard = read('js/parent-dashboard.js');
const serviceWorker = read('sw.js');

assert.match(adapter, /function comboFromElement\(element\)/);
assert.match(adapter, /querySelector\('path'\)/);
assert.match(adapter, /path\.getAttribute\('d'\)/);
assert.match(adapter, /path\.getAttribute\('fill'\)/);
assert.match(adapter, /path\.getAttribute\('stroke'\)/);
assert.doesNotMatch(adapter, /function comboFromHtml/);
assert.match(adapter, /\.map\(comboFromElement\)\.filter\(Boolean\)/);

assert.match(dashboard, /function renderGameSummary\(container, byGame, games\)/);
assert.match(dashboard, /Object\.keys\(inProgress\)/);
assert.match(dashboard, /Đang chơi dở/);
assert.match(dashboard, /progress\.byGame, progress\.games/);
assert.match(dashboard, /Chưa có hoạt động nào được lưu/);

assert.match(serviceWorker, /bonghome-v32-progress-visibility-fix/);

console.log('Progress visibility regression checks passed.');