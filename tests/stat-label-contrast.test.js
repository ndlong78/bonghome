'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const components = fs.readFileSync(path.resolve(__dirname, '../css/components.css'), 'utf8');

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('shared statistic labels keep at least 4.5:1 contrast on white', () => {
  const rule = components.match(/\.o-so \.nhan,\s*\.ket-qua \.nhan\s*\{[\s\S]*?color:\s*(#[0-9a-f]{6})/i);
  assert.ok(rule, 'Shared statistic label rule must define an explicit text color');
  const ratio = contrastRatio(rule[1], '#ffffff');
  assert.ok(ratio >= 4.5, `Statistic label contrast is ${ratio.toFixed(2)}:1; expected at least 4.5:1`);
});
