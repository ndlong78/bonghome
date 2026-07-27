const { test, expect } = require('@playwright/test');

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]) {
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(value) {
  const numbers = value.match(/\d+(?:\.\d+)?/g);
  return numbers ? numbers.slice(0, 3).map(Number) : null;
}

test('thông báo lưu Game 1 giữ tương phản chữ tối thiểu 4.5:1', async ({ page }) => {
  await page.goto('/game1.html', { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    const status = document.createElement('div');
    status.className = 'bh-game1-save-status';
    status.setAttribute('data-testid', 'game1-save-status-contrast-probe');
    status.textContent = 'Đã lưu tiến độ';
    document.body.appendChild(status);
  });

  const status = page.getByTestId('game1-save-status-contrast-probe');
  await expect(status).toBeVisible();

  const colors = await status.evaluate((element) => {
    const style = getComputedStyle(element);
    return { foreground: style.color, background: style.backgroundColor };
  });

  const foreground = parseRgb(colors.foreground);
  const background = parseRgb(colors.background);
  expect(foreground, 'Thông báo lưu cần màu chữ render hợp lệ').not.toBeNull();
  expect(background, 'Thông báo lưu cần màu nền render hợp lệ').not.toBeNull();
  expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
});
