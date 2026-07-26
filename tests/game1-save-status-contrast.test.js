const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'game1-autosave.css'), 'utf8');

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return 0.2126 * channel(channels[0]) + 0.7152 * channel(channels[1]) + 0.0722 * channel(channels[2]);
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('thông báo lưu Game 1 đạt tương phản tối thiểu 4.5:1', () => {
  const rule = css.match(/\.bh-game1-save-status\{([^}]*)\}/s)?.[1] || '';
  const foreground = rule.match(/color:(#[0-9A-Fa-f]{6})/)?.[1];
  const background = rule.match(/background:(#[0-9A-Fa-f]{6})/)?.[1];

  assert.equal(foreground, '#3D7962');
  assert.equal(background, '#EAFBF3');
  assert.ok(contrastRatio(foreground, background) >= 4.5, 'Thông báo lưu phải đạt 4.5:1');
});