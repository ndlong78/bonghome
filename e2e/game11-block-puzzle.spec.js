const { test, expect } = require('@playwright/test');

function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function waitForGame(page) {
  await page.goto('/game11.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame11));
}

test.describe('Game 11 - Xếp Khối Thông Minh', () => {
  test('hiển thị bàn 10x10, ba khối và đặt được khối bằng chạm/click', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await waitForGame(page);

    await expect(page.locator('.block-cell')).toHaveCount(100);
    await expect(page.locator('.block-piece')).toHaveCount(3);
    await expect(page.locator('#blockStatus')).toBeVisible();

    const firstPiece = page.locator('.block-piece').first();
    await firstPiece.click();
    await page.locator('.block-cell[data-row="0"][data-col="0"]').click();

    const state = await page.evaluate(() => window.BongGame11.getState());
    expect(state.score).toBe(4);
    expect(state.usedCells).toBe(4);
    expect(state.tray[0].used).toBe(true);
    expect(errors).toEqual([]);
  });

  test('có thể chơi bằng bàn phím và focus rõ ràng', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await waitForGame(page);

    await page.locator('.block-piece').first().click();
    const board = page.locator('#blockBoard');
    await board.focus();
    await expect(board).toBeFocused();
    await page.keyboard.press('Enter');

    const state = await page.evaluate(() => window.BongGame11.getState());
    expect(state.usedCells).toBe(4);
    expect(state.score).toBe(4);
    expect(errors).toEqual([]);
  });

  test('các nút điều khiển chính đủ lớn để chạm trên mobile', async ({ page }) => {
    await waitForGame(page);

    const selectors = ['.game11-home', '#blockReset', '.block-piece:not([disabled])'];
    for (const selector of selectors) {
      const boxes = await page.locator(selector).evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }));
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('trang chủ có bảng Game 11 và nội dung được cập nhật thành 11 lớp học', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const card = page.locator('[data-game11-card]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', 'game11.html');
    await expect(card).toContainText('Xếp Khối Thông Minh');
    await expect(page.locator('.phu-de')).toContainText('11 lớp học');
    expect(errors).toEqual([]);
  });

  test('Game 11 reload được khi offline sau khi Service Worker đã precache', async ({ page, context }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto('/index.html', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload({ waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await page.goto('/game11.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.BongGame11));
    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.BongGame11));
      await expect(page.locator('.block-cell')).toHaveCount(100);
      await expect(page.locator('.block-piece')).toHaveCount(3);
    } finally {
      await context.setOffline(false);
    }

    expect(errors).toEqual([]);
  });
});
