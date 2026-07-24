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

async function tabToSharedControl(page) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.keyboard.press('Tab');
    const matches = await page.evaluate((selector) => {
      const active = document.activeElement;
      return active instanceof Element && active.matches(selector);
    }, sharedControls);
    if (matches) return true;
  }
  return false;
}

test.describe('Focus bàn phím nhìn thấy rõ trên iPhone và iPad', () => {
  for (const path of pages) {
    test(`${path} có focus ring khi dùng phím Tab`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('.nut-am-thanh'));

      expect(await page.locator(sharedControls).count(), `${path} cần có điều khiển chung`).toBeGreaterThan(0);
      expect(await tabToSharedControl(page), `${path} cần đưa focus bằng Tab tới điều khiển chung`).toBe(true);

      const focusStyle = await page.evaluate(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) return null;
        const style = getComputedStyle(active);
        return {
          label: active.getAttribute('aria-label') || active.textContent?.trim() || active.className,
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth),
          outlineColor: style.outlineColor,
          outlineOffset: Number.parseFloat(style.outlineOffset)
        };
      });

      expect(focusStyle, `${path} phải có phần tử đang focus`).not.toBeNull();
      expect(focusStyle.outlineStyle, `${path}: ${focusStyle.label} không được ẩn outline`).not.toBe('none');
      expect(focusStyle.outlineWidth, `${path}: ${focusStyle.label} cần outline ít nhất 3px`).toBeGreaterThanOrEqual(3);
      expect(focusStyle.outlineColor, `${path}: ${focusStyle.label} cần màu outline nhìn thấy`).not.toBe('rgba(0, 0, 0, 0)');
      expect(focusStyle.outlineOffset, `${path}: ${focusStyle.label} cần tách focus ring khỏi nút`).toBeGreaterThanOrEqual(2);
    });
  }
});
