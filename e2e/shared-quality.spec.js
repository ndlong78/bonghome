const { test, expect } = require('@playwright/test');

/*
 * Lớp dùng chung pwa-quality.js chạy thật trên trang: nút tuỳ biến (role="button") bấm được bằng Enter/phím cách,
 * live region luôn đọc trọn câu (aria-atomic), hộp thoại thắng giữ focus bên trong và trả focus khi đóng,
 * bố cục gọn của Game 1 chỉ áp dụng ở Game 1. Thay cho các kiểm tra so chuỗi trên pwa-quality.js.
 */

async function openPage(page, path) {
  await page.goto(path, { waitUntil: 'load' });
  // pwa-quality.js do shared-ui.js nạp; nó gắn style #bhPwaQualityStyles hoặc lớp bh-* lên <html> khi chạy.
  await expect(page.locator('script[data-bh-pwa-quality]')).toBeAttached();
  await page.waitForFunction(() => document.readyState === 'complete');
}

test.describe('Lớp chất lượng dùng chung (pwa-quality.js)', () => {
  test('nút tuỳ biến role="button" bấm được bằng Enter và phím cách, trừ khi aria-disabled', async ({ page }) => {
    await openPage(page, '/game6.html');
    await page.evaluate(() => {
      window.__clicks = { on: 0, off: 0 };
      for (const [id, disabled] of [['bhTestOn', false], ['bhTestOff', true]]) {
        const button = document.createElement('div');
        button.id = id;
        button.setAttribute('role', 'button');
        button.tabIndex = 0;
        if (disabled) button.setAttribute('aria-disabled', 'true');
        button.textContent = id;
        button.addEventListener('click', () => { window.__clicks[disabled ? 'off' : 'on'] += 1; });
        document.querySelector('.khung, main, body').prepend(button);
      }
    });
    await page.locator('#bhTestOn').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.locator('#bhTestOff').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => window.__clicks)).toEqual({ on: 2, off: 0 });
  });

  test('live region có sẵn và thêm sau đều được đọc trọn câu; không ghi đè lựa chọn của trang', async ({ page }) => {
    await openPage(page, '/game6.html');
    const atomic = await page.evaluate(async () => {
      const make = (attributes) => {
        const element = document.createElement('div');
        Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
        return element;
      };
      const wrapper = document.createElement('section');
      const nested = make({ role: 'status' });
      wrapper.append(nested);
      const items = {
        status: make({ role: 'status' }),
        polite: make({ 'aria-live': 'polite' }),
        off: make({ 'aria-live': 'off' }),
        explicit: make({ role: 'status', 'aria-atomic': 'false' })
      };
      document.body.append(...Object.values(items), wrapper);
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        ...Object.fromEntries(Object.entries(items).map(([key, element]) => [key, element.getAttribute('aria-atomic')])),
        nested: nested.getAttribute('aria-atomic'),
        existing: [...document.querySelectorAll('[role="status"]:not([aria-atomic])')].length
      };
    });
    expect(atomic).toEqual({ status: 'true', polite: 'true', off: null, explicit: 'false', nested: 'true', existing: 0 });
  });

  test('hộp thoại thắng: focus vào nút đầu, Tab xoay vòng bên trong, nền bị khoá, đóng thì trả focus', async ({ page }) => {
    await openPage(page, '/game6.html');
    const dialog = page.locator('#manThang');
    await expect(dialog).toHaveAttribute('aria-hidden', 'true');
    const opener = page.locator('#nutAmThanh');
    await opener.focus();

    // Chỉ xét các phần tử có trên trang lúc mở: thông báo sinh ra sau đó (ví dụ "Đã lưu lượt hoàn thành" của
    // autosave) là live region, không được khoá kẻo trình đọc màn hình không đọc lên.
    await page.evaluate(() => {
      window.__beforeOpen = [...document.body.children].filter((item) => item.id !== 'manThang');
      document.getElementById('manThang').classList.add('hien');
    });
    await expect(dialog).toHaveAttribute('aria-hidden', 'false');
    const buttons = dialog.locator('button:not([disabled]), a[href]');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(1);
    await expect(buttons.first()).toBeFocused();
    expect(await page.evaluate(() => window.__beforeOpen
      .filter((item) => !item.inert)
      .map((item) => `${item.tagName}#${item.id}.${item.className}`))).toEqual([]);

    for (let i = 1; i < count; i += 1) await page.keyboard.press('Tab');
    await expect(buttons.last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(buttons.first(), 'Tab ở nút cuối quay về nút đầu').toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(buttons.last(), 'Shift+Tab ở nút đầu sang nút cuối').toBeFocused();

    await dialog.evaluate((element) => element.classList.remove('hien'));
    await expect(dialog).toHaveAttribute('aria-hidden', 'true');
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => [...document.body.children].some((item) => item.inert))).toBe(false);
  });

  test('bố cục gọn của bàn bài chỉ áp dụng ở Game 1 và theo số lá', async ({ page }) => {
    await openPage(page, '/game1.html');
    // Chờ nội dung JSON đổi mức Khó thành 12 cặp; bấm sớm hơn thì vẫn là mức dự phòng 8 cặp.
    await page.waitForFunction(() => window.BongGame1 && window.BongGame1Content && document.querySelectorAll('#mucDo button')[2]?.dataset.cap === '12');
    await expect(page.locator('html')).toHaveClass(/bh-game1-compact/);
    const columns = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bh-game1-cols').trim());
    await page.locator('#mucDo button').nth(2).click();
    await expect(page.locator('#sanBai .la-bai')).toHaveCount(24);
    await expect.poll(columns).toBe(String(page.viewportSize().width >= 700 ? 6 : 4));

    await openPage(page, '/game6.html');
    await expect(page.locator('html')).not.toHaveClass(/bh-game1-compact/);
  });
});
