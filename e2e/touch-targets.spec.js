const { test, expect } = require('@playwright/test');

const pages = [
  '/index.html',
  '/parents.html',
  '/collection.html',
  ...Array.from({ length: 10 }, (_, index) => `/game${index + 1}.html`)
];

const sharedControls = [
  '.nut-ve',
  '.bh-button',
  '.muc-do button',
  '.nhom-nut button',
  '.nhom-nut a',
  '.nhom-nut-duoi button',
  '.nut-am-thanh',
  '.bh-parent-back',
  '.bh-collection__back'
].join(',');

test.describe('Vùng chạm giao diện chung trên iPhone và iPad', () => {
  for (const path of pages) {
    test(`${path} giữ vùng chạm tối thiểu 44px`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('.nut-am-thanh'));

      const controls = page.locator(sharedControls).filter({ visible: true });
      expect(await controls.count(), `${path} cần có ít nhất một điều khiển chung`).toBeGreaterThan(0);

      const undersized = await controls.evaluateAll((elements) => elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label: element.getAttribute('aria-label') || element.textContent?.trim() || element.className,
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10
          };
        })
        .filter(({ width, height }) => width < 44 || height < 44));

      expect(undersized, `${path} có vùng chạm nhỏ hơn 44px`).toEqual([]);
    });
  }
});
