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

function colorFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\{[^}]*color:(#[0-9A-Fa-f]{6})`));
  return match?.[1];
}

test('hộp tiếp tục Game 1 dùng màu chữ phụ qua token tương phản', () => {
  expect(css).toMatch(/\.bh-game1-resume p\{[^}]*color:var\(--bh-color-muted,#806987\)/s);
  expect(contrastRatio('#806987', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
});

test('hai nút tiếp tục và chơi lại đạt tương phản tối thiểu 4.5:1', () => {
  const continueColor = colorFor('.bh-game1-continue');
  const restartColor = colorFor('.bh-game1-restart');

  expect(continueColor).toBe('#5B3C62');
  expect(restartColor).toBe('#365E80');
  expect(contrastRatio(continueColor, '#FFB7C5')).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(restartColor, '#BFE3FF')).toBeGreaterThanOrEqual(4.5);
});
