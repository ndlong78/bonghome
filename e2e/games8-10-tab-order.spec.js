const { test, expect } = require('@playwright/test');

const pages = ['/game8.html', '/game9.html', '/game10.html'];

const tabbableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

async function collectTabSequence(page) {
  const maxTabs = await page.evaluate((selector) => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    };
    return [...document.querySelectorAll(selector)].filter(visible).length + 1;
  }, tabbableSelector);

  const sequence = [];
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof Element)) return null;
      return {
        id: active.id,
        classes: [...active.classList],
        label: active.getAttribute('aria-label') || active.textContent?.trim() || active.tagName,
        hiddenDialog: Boolean(active.closest('.man-thang:not(.hien)')),
        disabled: active.matches(':disabled,[aria-disabled="true"]'),
        insideMainContent: Boolean(active.closest('.khung'))
      };
    });
    if (state) sequence.push(state);
  }
  return sequence;
}

function findClass(sequence, className) {
  return sequence.findIndex((entry) => entry.classes.includes(className));
}

test.describe('Thứ tự Tab Game 8–10', () => {
  for (const path of pages) {
    test(`${path} giữ thứ tự điều khiển ổn định và bỏ qua phần tử ẩn`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('.nut-am-thanh'));

      const sequence = await collectTabSequence(page);
      expect(sequence.length, `${path} cần có điều khiển nhận focus`).toBeGreaterThan(0);
      expect(sequence.filter((entry) => entry.hiddenDialog), `${path} không được focus vào hộp thắng đang ẩn`).toEqual([]);
      expect(sequence.filter((entry) => entry.disabled), `${path} không được focus vào điều khiển disabled`).toEqual([]);

      const homeIndex = findClass(sequence, 'nut-ve');
      const soundIndex = findClass(sequence, 'nut-am-thanh');
      const mainControlIndexes = sequence
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.insideMainContent && !entry.classes.includes('nut-ve'))
        .map(({ index }) => index);

      expect(homeIndex, `${path} cần đưa Tab tới nút Về nhà`).toBeGreaterThanOrEqual(0);
      expect(soundIndex, `${path} cần đưa Tab tới nút âm thanh`).toBeGreaterThanOrEqual(0);
      expect(mainControlIndexes.length, `${path} cần có ít nhất một điều khiển trong nội dung chính`).toBeGreaterThan(0);
      expect(homeIndex, `${path}: Về nhà phải đứng trước điều khiển trò chơi`).toBeLessThan(Math.min(...mainControlIndexes));
      expect(soundIndex, `${path}: nút âm thanh phải đứng sau điều khiển trò chơi`).toBeGreaterThan(Math.max(...mainControlIndexes));
    });
  }
});
