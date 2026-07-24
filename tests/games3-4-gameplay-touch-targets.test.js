'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const game3 = fs.readFileSync(path.join(root, 'game3.html'), 'utf8');
const game4 = fs.readFileSync(path.join(root, 'game4.html'), 'utf8');

function readFixedSize(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = source.match(new RegExp(`${escaped}\\s*\\{([^}]]+)\\}`));
  assert.ok(block, `Không tìm thấy CSS cho ${selector}`);
  const width = Number(block[1].match(/width\s*:\s*(\d+)px/)?.[1]);
  const height = Number(block[1].match(/height\s*:\s*(\d+)px/)?.[1]);
  return { width, height };
}

function assertMinimumTarget(source, selector) {
  const size = readFixedSize(source, selector);
  assert.ok(Number.isFinite(size.width), `${selector} cần khai báo width theo px`);
  assert.ok(Number.isFinite(size.height), `${selector} cần khai báo height theo px`);
  assert.ok(size.width >= 44, `${selector} rộng ${size.width}px, cần tối thiểu 44px`);
  assert.ok(size.height >= 44, `${selector} cao ${size.height}px, cần tối thiểu 44px`);
}

test('Game 3 keeps draggable pieces and shadow targets at least 44px', () => {
  assertMinimumTarget(game3, '.mieng-hinh');
  assertMinimumTarget(game3, '.o-bong');
});

test('Game 4 keeps draggable objects at least 44px and baskets responsive', () => {
  assertMinimumTarget(game4, '.do-vat');
  assert.match(game4, /\.hang-gio\s*\{[^}]*grid-template-columns\s*:\s*repeat\(4,1fr\)/s);
  assert.match(game4, /@media\s*\(max-width:520px\)\s*\{\s*\.hang-gio\s*\{\s*grid-template-columns\s*:\s*repeat\(2,1fr\)/s);
  assert.match(game4, /\.gio\s*\{[^}]*padding\s*:\s*8px 6px 10px/s);
});
