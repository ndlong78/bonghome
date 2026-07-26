const { test, expect } = require('@playwright/test');

const pages = [
  '/index.html',
  '/parents.html',
  ...Array.from({ length: 10 }, (_, index) => `/game${index + 1}.html`)
];

test.describe('Giảm chuyển động trên toàn bộ Bông Home', () => {
  test('mọi trang đều vô hiệu hóa animation và transition nhìn thấy', async ({ page }) => {
    for (const path of pages) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body'), `${path} phải hiển thị`).toBeVisible();

      await expect.poll(
        () => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
        { message: `${path} phải thực sự chạy với prefers-reduced-motion: reduce` }
      ).toBe(true);

      await page.waitForFunction(() => (
        !window.BongModulesReady
        || typeof window.BongModulesReady.then === 'function'
      ));
      await page.evaluate(async () => {
        if (window.BongModulesReady) await window.BongModulesReady;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });

      const movingElements = await page.evaluate(() => {
        const parseDurations = (value) => value.split(',').map((item) => {
          const duration = item.trim();
          if (duration.endsWith('ms')) return Number.parseFloat(duration) / 1000;
          if (duration.endsWith('s')) return Number.parseFloat(duration);
          return 0;
        });
        const parseList = (value) => value.split(',').map((item) => item.trim());
        const hasActiveTimedItem = (names, durations) => names.some((name, index) => {
          const duration = durations[index % durations.length] || 0;
          return name !== 'none' && duration > 0.001;
        });

        return [...document.querySelectorAll('*')]
          .map((element) => {
            const style = getComputedStyle(element);
            const animationNames = parseList(style.animationName);
            const animationDurations = parseDurations(style.animationDuration);
            const transitionProperties = parseList(style.transitionProperty);
            const transitionDurations = parseDurations(style.transitionDuration);
            return {
              tag: element.tagName.toLowerCase(),
              id: element.id,
              className: typeof element.className === 'string' ? element.className : '',
              animationNames,
              animationDurations,
              transitionProperties,
              transitionDurations,
              activeAnimation: hasActiveTimedItem(animationNames, animationDurations),
              activeTransition: hasActiveTimedItem(transitionProperties, transitionDurations)
            };
          })
          .filter((item) => item.activeAnimation || item.activeTransition);
      });

      expect(movingElements, `${path} không được giữ chuyển động nhìn thấy dài hơn 1ms`).toEqual([]);
    }
  });
});
