const { test, expect } = require('@playwright/test');

/*
 * Chế độ toàn màn hình (js/fullscreen.js + css/fullscreen.css): mỗi game có nút ⛶ trên thanh tiêu đề; bấm thì
 * game lấp đầy khung màn hình, bấm lại (hoặc thoát toàn màn hình của trình duyệt) thì trở về trang thường.
 */

const GAMES = Array.from({ length: 15 }, (_, index) => index + 1);
// Game có bàn chơi co giãn theo màn hình và phần tử phải nằm trọn trong khung khi toàn màn hình.
const FITTED = {
  1: ['#sanBai'],
  2: ['.hai-tranh'],
  5: ['.bang-ve'],
  8: ['.bang-me-cung'],
  10: ['.bang-nhac'],
  11: ['#blockBoard'],
  12: ['#sudokuBoard'],
  13: ['#tttBoard'],
  14: ['#caroBoard'],
  15: ['#advStage', '[data-control="jump"]']
};

async function open(page, id) {
  await page.addInitScript(() => sessionStorage.setItem('bh_install_tip_closed', '1'));
  await page.goto(`/game${id}.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.BongFullscreen));
}

const toggle = (page) => page.locator('[data-bh-fullscreen]');

test.describe('Nút toàn màn hình', () => {
  for (const id of GAMES) {
    test(`game ${id}: bấm ⛶ thì vào chế độ toàn màn hình, bấm lại thì thoát`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await open(page, id);
      const button = toggle(page);
      await expect(button).toHaveCount(1);
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('aria-label', 'Chơi toàn màn hình');
      await expect(button).toHaveAttribute('aria-pressed', 'false');
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);

      await button.click();
      await expect(page.locator('html')).toHaveClass(/bh-fullscreen/);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(button).toHaveAttribute('aria-label', 'Thoát toàn màn hình');
      // Lời giới thiệu/mẹo của trang web được ẩn để nhường chỗ cho game.
      const intro = page.locator('.huong-dan, [class$="-intro"]').first();
      if (await intro.count()) await expect(intro).toBeHidden();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, 'không tràn ngang').toBeLessThanOrEqual(1);

      await button.click();
      await expect(page.locator('html')).not.toHaveClass(/bh-fullscreen/);
      await expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(errors).toEqual([]);
    });
  }
});

test.describe('Bàn chơi vừa khung màn hình khi toàn màn hình', () => {
  for (const [label, viewport] of [['laptop', { width: 1366, height: 768 }], ['điện thoại xoay ngang', { width: 844, height: 390 }]]) {
    test.describe(label, () => {
      test.use({ viewport });
      for (const [id, selectors] of Object.entries(FITTED)) {
        test(`game ${id}`, async ({ page }) => {
          await open(page, id);
          await page.evaluate(() => window.BongFullscreen.enter());
          await expect(page.locator('html')).toHaveClass(/bh-fullscreen/);
          // Phép đo cỡ bàn chạy ở khung hình kế tiếp (và đo lại khi nội dung đổi): chờ tới khi bàn đã vừa khung.
          for (const selector of selectors) {
            await expect.poll(async () => {
              const box = await page.locator(selector).first().boundingBox();
              if (!box) return 'không thấy';
              if (box.y < 0) return 'tràn trên';
              if (box.y + box.height > viewport.height + 1) return 'tràn đáy';
              if (box.x + box.width > viewport.width + 1) return 'tràn phải';
              return 'vừa';
            }, { message: selector }).toBe('vừa');
          }
        });
      }
    });
  }

  test('laptop: bàn chơi to hơn khi vào toàn màn hình (Game 13)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page, 13);
    const before = (await page.locator('#tttBoard').boundingBox()).width;
    await page.evaluate(() => window.BongFullscreen.enter());
    await expect.poll(async () => (await page.locator('#tttBoard').boundingBox()).width).toBeGreaterThan(before);
  });
});

test.describe('Giữ chế độ trong phiên', () => {
  test('trình duyệt không có toàn màn hình thật (iPhone): sang game khác vẫn giữ chế độ chơi gọn', async ({ page }) => {
    await page.addInitScript(() => {
      // Giả lập Safari iPhone: không có Fullscreen API cho trang.
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false, configurable: true });
      Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false, configurable: true });
    });
    await open(page, 13);
    await toggle(page).click();
    await expect(page.locator('html')).toHaveClass(/bh-fullscreen/);
    await page.goto('/game14.html', { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.BongFullscreen));
    await expect(page.locator('html')).toHaveClass(/bh-fullscreen/);
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    await toggle(page).click();
    await page.goto('/game13.html', { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.BongFullscreen));
    await expect(page.locator('html')).not.toHaveClass(/bh-fullscreen/);
  });
});
