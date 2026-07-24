const { test, expect } = require('@playwright/test');

const games = Array.from({ length: 10 }, (_, index) => `/game${index + 1}.html`);

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
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  return match[1].split(',').slice(0, 3).map((part) => Number.parseFloat(part.trim()));
}

test.describe('Độ tương phản chữ hướng dẫn', () => {
  for (const path of games) {
    test(`${path} đạt tối thiểu 4.5:1`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const instruction = page.locator('.huong-dan').first();
      await expect(instruction).toBeVisible();

      const colors = await instruction.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          foreground: style.color,
          background: getComputedStyle(document.body).backgroundColor
        };
      });

      const foreground = parseRgb(colors.foreground);
      const background = parseRgb(colors.background);
      expect(foreground, `${path} cần màu chữ render hợp lệ`).not.toBeNull();
      expect(background, `${path} cần màu nền render hợp lệ`).not.toBeNull();
      expect(contrastRatio(foreground, background), `${path} có chữ hướng dẫn dưới 4.5:1`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
