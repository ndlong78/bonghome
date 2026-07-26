const { test, expect } = require('@playwright/test');

const pages = [
  '/index.html',
  '/parents.html',
  ...Array.from({ length: 10 }, (_, index) => `/game${index + 1}.html`)
];

function parseDurations(value) {
  return value.split(',').map((item) => {
    const duration = item.trim();
    if (duration.endsWith('ms')) return Number.parseFloat(duration) / 1000;
    if (duration.endsWith('s')) return Number.parseFloat(duration);
    return 0;
  });
}

test.describe('Giảm chuyển động trên toàn bộ Bông Home', () => {
  test.use({ reducedMotion: 'reduce' });

  test('mọi trang đều rút animation và transition xuống gần 0', async ({ page }) => {
    for (const path of pages) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body'), `${path} phải hiển thị`).toBeVisible();

      const movingElements = await page.evaluate(() => {
        const parse = (value) => value.split(',').map((item) => {
          const duration = item.trim();
          if (duration.endsWith('ms')) return Number.parseFloat(duration) / 1000;
          if (duration.endsWith('s')) return Number.parseFloat(duration);
          return 0;
        });

        return [...document.querySelectorAll('*')]
          .map((element) => {
            const style = getComputedStyle(element);
            const animation = Math.max(...parse(style.animationDuration), 0);
            const transition = Math.max(...parse(style.transitionDuration), 0);
            return {
              tag: element.tagName.toLowerCase(),
              id: element.id,
              className: typeof element.className === 'string' ? element.className : '',
              animation,
              transition
            };
          })
          .filter((item) => item.animation > 0.001 || item.transition > 0.001);
      });

      expect(movingElements, `${path} không được giữ chuyển động dài hơn 1ms`).toEqual([]);
    }
  });
});
