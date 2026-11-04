const { test, expect } = require('@playwright/test');

/*
 * Bố cục không được "nhảy" dưới tay bé:
 *  - lúc tải trang: CSS dùng chung nằm sẵn trong <head>, các hàng nút dựng sau khi nạp nội dung đã có chỗ giữ;
 *  - trên laptop màn thấp (1366×768): bàn chơi và nút điều khiển chính nằm trọn trong màn hình đầu tiên;
 *  - khi chơi: đổi chế độ, kéo hình vào đúng chỗ, gõ phím mũi tên không làm phần khác dịch chuyển.
 */

const GAMES = Array.from({ length: 15 }, (_, index) => index + 1);

/** Tổng điểm dịch chuyển bố cục (CLS) không do người dùng gây ra, đo từ lúc trang bắt đầu tải. */
async function collectLayoutShift(page) {
  await page.addInitScript(() => {
    window.__bhShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__bhShift += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

test.describe('Bố cục ổn định khi tải trang', () => {
  for (const id of GAMES) {
    test(`/game${id}.html không nhảy bố cục khi tải`, async ({ page }) => {
      await page.addInitScript(() => sessionStorage.setItem('bh_install_tip_closed', '1'));
      await collectLayoutShift(page);
      await page.goto(`/game${id}.html`, { waitUntil: 'load' });
      await page.evaluate(() => window.BongModulesReady);
      await page.waitForTimeout(800);
      const shift = await page.evaluate(() => window.__bhShift);
      // Ngưỡng "tốt" của Core Web Vitals là 0,1; giữ chặt hơn để bắt lỗi sớm.
      expect(shift, `CLS của game ${id}`).toBeLessThan(0.05);
    });
  }
});

test.describe('Laptop màn thấp 1366×768', () => {
  test.use({ viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false });

  // Phần tử phải nằm trọn trong màn hình đầu tiên (không cuộn) để bé chơi được ngay.
  const MUST_FIT = {
    5: ['.bang-ve', '#nutHinhMoi'],
    8: ['.bang-me-cung', '.phim-huong'],
    10: ['.bang-nhac', '#nutBatDau'],
    11: ['#blockBoard'],
    12: ['#sudokuBoard', '.sudoku-tools'],
    13: ['#tttBoard'],
    14: ['#caroBoard'],
    15: ['#advStage', '#advPad']
  };

  for (const [id, selectors] of Object.entries(MUST_FIT)) {
    test(`game ${id}: bàn chơi và nút chính nằm trọn màn hình`, async ({ page }) => {
      await page.addInitScript(() => sessionStorage.setItem('bh_install_tip_closed', '1'));
      await page.goto(`/game${id}.html`, { waitUntil: 'load' });
      await page.evaluate(() => window.BongModulesReady);
      for (const selector of selectors) {
        const box = await page.locator(selector).first().boundingBox();
        expect(box, selector).not.toBeNull();
        expect(box.y, `${selector} bắt đầu trong màn hình`).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, `${selector} không tràn đáy màn hình`).toBeLessThanOrEqual(768);
      }
    });
  }

  test('game 11: bấm nút Trái trên màn hình rồi dùng phím mũi tên thì trang không bị cuộn', async ({ page }) => {
    await page.goto('/game11.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#blockBoard .block-cell').length > 0);
    await page.evaluate(() => {
      scrollTo(0, 60);
      document.getElementById('blockLeft').focus({ preventScroll: true });
    });
    const before = await page.evaluate(() => scrollY);
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowRight']) await page.keyboard.press(key);
    expect(await page.evaluate(() => scrollY)).toBe(before);
  });
});

test.describe('Bố cục ổn định khi chơi', () => {
  for (const [id, prefix] of [[13, 'ttt'], [14, 'caro']]) {
    test(`game ${id}: đổi "Chơi với bạn" ↔ "Chơi với Gấu" không làm bàn cờ nhảy`, async ({ page }) => {
      await page.goto(`/game${id}.html`, { waitUntil: 'load' });
      await page.waitForFunction((n) => Boolean(window[`BongGame${n}`]), id);
      const boardTop = () => page.locator(`#${prefix}Board`).evaluate((board) => Math.round(board.getBoundingClientRect().top + scrollY));
      const top = await boardTop();
      await page.locator(`.${prefix}-mode[data-mode="friend"]`).click();
      await expect(page.locator(`#${prefix}Levels`)).toBeHidden();
      expect(await boardTop()).toBe(top);
      await page.locator(`.${prefix}-mode[data-mode="bot"]`).click();
      await expect(page.locator(`#${prefix}Levels`)).toBeVisible();
      expect(await boardTop()).toBe(top);
    });
  }

  test('game 4: kéo đúng một đồ vật vào giỏ thì các đồ vật còn lại đứng yên', async ({ page }) => {
    await page.goto('/game4.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#sanDo .do-vat').length === 12);
    const positions = () => page.locator('#sanDo .do-vat:not(.xong)').evaluateAll((items) => items.map((item) => {
      const rect = item.getBoundingClientRect();
      return `${item.dataset.index ?? ''}@${Math.round(rect.left)},${Math.round(rect.top)}`;
    }));
    const target = await page.evaluate(() => {
      const item = document.querySelector('#sanDo .do-vat');
      const color = item.dataset.mau;
      const basket = color ? document.querySelector(`.gio[data-mau="${color}"]`) : null;
      return { color, basket: Boolean(basket) };
    });
    test.skip(!target.basket, 'đồ vật không ghi màu trong DOM');
    const item = page.locator('#sanDo .do-vat').first();
    const before = (await positions()).slice(1);
    await item.dragTo(page.locator(`.gio[data-mau="${target.color}"]`));
    await expect(item).toHaveClass(/xong/);
    expect(await positions()).toEqual(before);
  });
});
