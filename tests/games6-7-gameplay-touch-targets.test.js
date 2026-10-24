'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const game6Engine = require('../js/game6-engine.js');
const game7 = fs.readFileSync(path.join(root, 'game7.html'), 'utf8');

const MIN_TARGET_PX = 44;
const PHONE_WIDTH_PX = 390;

test('Game 6 keeps every round above 44px on iPhone width', () => {
  // Dùng đúng hàm cỡ ô và cấu hình vòng mà giao diện Game 6 dùng (js/game6-engine.js).
  assert.deepEqual(game6Engine.ROUNDS.at(-1), { cells: 30, columns: 6 });
  for (const round of game6Engine.ROUNDS) {
    const size = game6Engine.cellSize(PHONE_WIDTH_PX, round.columns);
    assert.ok(size >= MIN_TARGET_PX, `Ô Game 6 (${round.columns} cột) chỉ ${size}px, cần tối thiểu ${MIN_TARGET_PX}px`);
  }
});

test('Game 7 keeps choices responsive and touch-friendly', () => {
  assert.match(game7, /\.lua-chon\s*\{[^}]*grid-template-columns\s*:\s*repeat\(4,1fr\)/s);
  assert.match(game7, /@media\s*\(max-width:520px\)\s*\{\s*\.lua-chon\s*\{\s*grid-template-columns\s*:\s*repeat\(2,1fr\)/s);
  assert.match(game7, /\.nut-chon\s*\{[^}]*padding\s*:\s*10px/s);
  assert.match(game7, /\.nut-chon svg\s*\{[^}]*width\s*:\s*100%/s);
});
