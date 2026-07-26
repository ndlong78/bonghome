const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const components = fs.readFileSync(path.join(root, 'css', 'components.css'), 'utf8');
const tokens = fs.readFileSync(path.join(root, 'css', 'design-tokens.css'), 'utf8');

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

test('câu khen hộp hoàn thành dùng token chữ phụ đủ tương phản', () => {
  const muted = tokens.match(/--bh-color-muted:\s*(#[0-9a-f]{6})/i)?.[1];
  const surface = tokens.match(/--bh-color-surface:\s*(#[0-9a-f]{6})/i)?.[1];

  assert.ok(muted && surface, 'Cần khai báo token muted và surface');
  assert.ok(contrastRatio(muted, surface) >= 4.5, 'Câu khen phải đạt tối thiểu 4.5:1 trên nền hộp trắng');
  assert.match(
    components,
    /\.hop-thang \.loi\s*\{[^}]*color:\s*var\(--bh-color-muted\)\s*!important/s,
    'Selector chung phải thắng màu nội tuyến cũ trong từng game'
  );
});

test('Game 1–10 đều có câu khen trong hộp hoàn thành', () => {
  for (let game = 1; game <= 10; game += 1) {
    const html = fs.readFileSync(path.join(root, `game${game}.html`), 'utf8');
    assert.match(
      html,
      /class=["'][^"']*hop-thang[^"']*["'][\s\S]*?class=["'][^"']*loi[^"']*["']/,
      `Game ${game} cần có .hop-thang .loi để áp dụng baseline chung`
    );
  }
});
