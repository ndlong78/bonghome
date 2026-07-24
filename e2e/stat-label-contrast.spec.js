const { test, expect } = require('@playwright/test');

const gamePages = Array.from({ length: 10 }, (_, index) => `/game${index + 1}.html`);

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb) {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbNumbers(value) {
  return value.replace(/[^0-9,.]/g, '').split(',').slice(0, 3).map(Number);
}

test.describe('Độ tương phản nhãn thống kê', () => {
  for (const path of gamePages) {
    test(`${path} giữ nhãn nhỏ tối thiểu 4.5:1`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('.nut-am-thanh'));

      const labels = page.locator('.o-so .nhan, .ket-qua .nhan').filter({ visible: true });
      const count = await labels.count();
      expect(count, `${path} cần có nhãn thống kê đang hiển thị`).toBeGreaterThan(0);

      for (let index = 0; index < count; index += 1) {
        const label = labels.nth(index);
        const foreground = rgbNumbers(await label.evaluate((element) => getComputedStyle(element).color));
        const background = rgbNumbers(await label.evaluate((element) => getComputedStyle(element.parentElement).backgroundColor));
        const ratio = contrastRatio(foreground, background);
        expect(ratio, `${path} nhãn ${index + 1} chỉ đạt ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
