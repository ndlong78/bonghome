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
  const values = value.match(/\d+(?:\.\d+)?/g);
  return values ? values.slice(0, 3).map(Number) : null;
}

test.describe('Độ tương phản câu khen hộp hoàn thành', () => {
  for (const gamePath of games) {
    test(`${gamePath} đạt tối thiểu 4.5:1`, async ({ page }) => {
      await page.goto(gamePath, { waitUntil: 'domcontentloaded' });
      await page.locator('.man-thang').evaluate((dialog) => dialog.classList.add('hien'));

      const praise = page.locator('.hop-thang .loi').first();
      await expect(praise).toBeVisible();

      const colors = await praise.evaluate((element) => {
        const foreground = getComputedStyle(element).color;
        let current = element;
        let background = 'rgba(0, 0, 0, 0)';

        while (current) {
          background = getComputedStyle(current).backgroundColor;
          const values = background.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
          const isTransparent = background === 'transparent'
            || (background.startsWith('rgba') && values[3] === 0);
          if (!isTransparent) break;
          current = current.parentElement;
        }

        return { foreground, background };
      });

      const foreground = parseRgb(colors.foreground);
      const background = parseRgb(colors.background);
      expect(foreground, `${gamePath} cần màu chữ render hợp lệ`).not.toBeNull();
      expect(background, `${gamePath} cần màu nền render hợp lệ`).not.toBeNull();
      expect(
        contrastRatio(foreground, background),
        `${gamePath} có câu khen dưới 4.5:1`
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
