const { test, expect } = require('@playwright/test');

const cases = [
  { path: '/game2.html', expected: ['.nut-ve', '#nutGoiY', '#nutVanMoi', '.nut-am-thanh'] },
  { path: '/game3.html', expected: ['.nut-ve', '#nutVanMoi', '.nut-am-thanh'] },
  { path: '/game4.html', expected: ['.nut-ve', '#nutVanMoi', '.nut-am-thanh'] }
];

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
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
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
        disabled: active.matches(':disabled,[aria-disabled="true"]')
      };
    });
    if (state) sequence.push(state);
  }
  return sequence;
}

function indexOfSelector(sequence, selector) {
  if (selector.startsWith('#')) return sequence.findIndex((item) => item.id === selector.slice(1));
  if (selector.startsWith('.')) return sequence.findIndex((item) => item.classes.includes(selector.slice(1)));
  return -1;
}

test.describe('Thứ tự Tab Game 2–4', () => {
  for (const item of cases) {
    test(`${item.path} có thứ tự điều khiển hợp lý và bỏ qua phần tử ẩn`, async ({ page }) => {
      await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('.nut-am-thanh'));
      if (item.path === '/game3.html') {
        await page.waitForFunction(() => window.BongGame3KeyboardMatching && document.querySelectorAll('.mieng-hinh[tabindex="0"]').length > 0);
      }
      if (item.path === '/game4.html') {
        await page.waitForFunction(() => window.BongGame4KeyboardSorting && document.querySelectorAll('.do-vat[tabindex="0"]').length > 0);
      }

      const sequence = await collectTabSequence(page);
      expect(sequence.length, `${item.path} cần có điều khiển nhận focus`).toBeGreaterThan(0);
      expect(sequence.filter((entry) => entry.hiddenDialog), `${item.path} không được focus vào hộp thắng đang ẩn`).toEqual([]);
      expect(sequence.filter((entry) => entry.disabled), `${item.path} không được focus vào điều khiển disabled`).toEqual([]);

      const positions = item.expected.map((selector) => ({ selector, index: indexOfSelector(sequence, selector) }));
      positions.forEach(({ selector, index }) => {
        expect(index, `${item.path} cần đưa Tab tới ${selector}`).toBeGreaterThanOrEqual(0);
      });

      for (let index = 1; index < positions.length; index += 1) {
        expect(
          positions[index].index,
          `${item.path}: ${positions[index - 1].selector} phải đứng trước ${positions[index].selector}`
        ).toBeGreaterThan(positions[index - 1].index);
      }
    });
  }
});