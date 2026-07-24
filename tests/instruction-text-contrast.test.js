const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const tokens = fs.readFileSync(path.join(root, 'css/design-tokens.css'), 'utf8');
const components = fs.readFileSync(path.join(root, 'css/components.css'), 'utf8');

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const values = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  return 0.2126 * channel(values[0]) + 0.7152 * channel(values[1]) + 0.0722 * channel(values[2]);
}

function contrastRatio(first, second) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

test('màu chữ phụ đạt tối thiểu 4.5:1 trên nền kem và trắng', () => {
  const muted = tokens.match(/--bh-color-muted:\s*(#[0-9a-f]{6})/i)?.[1];
  const cream = tokens.match(/--bh-color-cream:\s*(#[0-9a-f]{6})/i)?.[1];
  const surface = tokens.match(/--bh-color-surface:\s*(#[0-9a-f]{6})/i)?.[1];

  assert.ok(muted && cream && surface, 'Cần khai báo đủ token muted, cream và surface');
  assert.ok(contrastRatio(muted, cream) >= 4.5, 'Chữ phụ phải đạt 4.5:1 trên nền kem');
  assert.ok(contrastRatio(muted, surface) >= 4.5, 'Chữ phụ phải đạt 4.5:1 trên nền trắng');
});

test('hướng dẫn và nhãn thống kê cùng dùng token màu chữ phụ', () => {
  assert.match(components, /\.huong-dan\s*\{[^}]*color:\s*var\(--bh-color-muted\)/s);
  assert.match(components, /\.o-so \.nhan,[\s\S]*?\.ket-qua \.nhan\s*\{[^}]*color:\s*var\(--bh-color-muted\)/s);
});
