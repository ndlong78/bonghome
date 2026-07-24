'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const game8 = fs.readFileSync(path.join(root, 'game8.html'), 'utf8');
const game9 = fs.readFileSync(path.join(root, 'game9.html'), 'utf8');
const game10 = fs.readFileSync(path.join(root, 'game10.html'), 'utf8');

const MIN_TARGET_PX = 44;

function minimumButtonHeight(verticalPadding, borderWidth, fontSize) {
  return (verticalPadding * 2) + (borderWidth * 2) + fontSize;
}

test('Game 8 keeps all four direction controls at least 44px square', () => {
  assert.match(game8, /\.phim-huong\s*\{[^}]*grid-template-columns\s*:\s*repeat\(3,72px\)[^}]*grid-template-rows\s*:\s*repeat\(2,72px\)/s);
  assert.match(game8, /<button class="len"[\s\S]*?<button class="trai"[\s\S]*?<button class="xuong"[\s\S]*?<button class="phai"/);
  assert.ok(72 >= MIN_TARGET_PX);
});

test('Game 9 keeps the keyword catch button comfortably above 44px', () => {
  assert.match(game9, /\.nut-bat\s*\{[^}]*width\s*:\s*100%[^}]*font-size\s*:\s*26px[^}]*padding\s*:\s*24px 12px[^}]*border\s*:\s*5px solid/s);
  const minimumHeight = minimumButtonHeight(24, 5, 26);
  assert.ok(minimumHeight >= MIN_TARGET_PX, `Nút Game 9 cao tối thiểu ${minimumHeight}px, cần ${MIN_TARGET_PX}px`);
});

test('Game 10 keeps the rhythm tap button comfortably above 44px', () => {
  assert.match(game10, /\.nut-go\s*\{[^}]*width\s*:\s*100%[^}]*font-size\s*:\s*24px[^}]*padding\s*:\s*28px 12px[^}]*border\s*:\s*5px solid/s);
  const minimumHeight = minimumButtonHeight(28, 5, 24);
  assert.ok(minimumHeight >= MIN_TARGET_PX, `Nút Game 10 cao tối thiểu ${minimumHeight}px, cần ${MIN_TARGET_PX}px`);
});
