'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const game6 = fs.readFileSync(path.join(root, 'game6.html'), 'utf8');
const game7 = fs.readFileSync(path.join(root, 'game7.html'), 'utf8');

const MIN_TARGET_PX = 44;
const PHONE_WIDTH_PX = 390;

function game6CellSize(viewportWidth, columns) {
  return Math.min(96, Math.floor(Math.min(viewportWidth - 40, 720) / columns) - 10);
}

test('Game 6 keeps the densest six-column round above 44px on iPhone width', () => {
  assert.match(game6, /const CAC_VONG\s*=\s*\[[\s\S]*?\{\s*o\s*:\s*30\s*,\s*cot\s*:\s*6\s*\}/);
  assert.match(game6, /const rong\s*=\s*Math\.min\(96,\s*Math\.floor\(Math\.min\(innerWidth-40,\s*720\)\/c\.cot\)-10\)/);
  assert.match(game6, /o\.style\.height\s*=\s*rong\+"px"/);
  const minimumCell = game6CellSize(PHONE_WIDTH_PX, 6);
  assert.ok(minimumCell >= MIN_TARGET_PX, `Ô Game 6 nhỏ nhất ${minimumCell}px, cần tối thiểu ${MIN_TARGET_PX}px`);
});

test('Game 7 keeps choices responsive and touch-friendly', () => {
  assert.match(game7, /\.lua-chon\s*\{[^}]*grid-template-columns\s*:\s*repeat\(4,1fr\)/s);
  assert.match(game7, /@media\s*\(max-width:520px\)\s*\{\s*\.lua-chon\s*\{\s*grid-template-columns\s*:\s*repeat\(2,1fr\)/s);
  assert.match(game7, /\.nut-chon\s*\{[^}]*padding\s*:\s*10px/s);
  assert.match(game7, /\.nut-chon svg\s*\{[^}]*width\s*:\s*100%/s);
});
