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

/** Giới hạn cứng để vòng Tab không chạy mãi nếu trang có bẫy focus. */
const MAX_TAB_PRESSES = 200;

/**
 * Nhấn Tab cho đến khi focus tới một điều khiển chung, hoặc quay vòng về phần tử đầu tiên.
 * Không đếm trước số phần tử nhận Tab: trang chủ còn chèn thêm thẻ game, chọn chủ đề, hồ sơ
 * sau khi tải, nên con số đếm sớm thiếu và nút âm thanh (cuối thứ tự Tab) bị bỏ lỡ.
 */
async function tabToSharedControl(page) {
  await page.evaluate(() => document.querySelectorAll('[data-focus-probe-first]').forEach((element) => element.removeAttribute('data-focus-probe-first')));
  for (let attempt = 0; attempt < MAX_TAB_PRESSES; attempt += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate((selector) => {
      const active = document.activeElement;
      if (!(active instanceof Element) || active === document.body) return 'none';
      if (active.matches(selector)) return 'match';
      if (active.hasAttribute('data-focus-probe-first')) return 'wrapped';
      if (!document.querySelector('[data-focus-probe-first]')) active.setAttribute('data-focus-probe-first', '');
      return 'continue';
    }, sharedControls);
    if (state === 'match') return true;
    if (state === 'wrapped') return false;
  }
  return false;
}

/** Chờ trang dựng xong các phần chèn sau khi tải (module dùng chung, thẻ game, chọn chủ đề). */
async function waitForSettledPage(page) {
  await page.waitForLoadState('load');
  await page.waitForFunction(() => document.querySelector('.nut-am-thanh'));
  await page.evaluate(() => window.BongModulesReady);
  await page.waitForLoadState('networkidle');
}

test.describe('Focus bàn phím nhìn thấy rõ trên iPhone và iPad', () => {
  for (const path of pages) {
    test(`${path} có focus ring khi dùng phím Tab`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await waitForSettledPage(page);

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
