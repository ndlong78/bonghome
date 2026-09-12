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

async function pauseGame(page) {
  await page.evaluate(() => window.BongGame11.pause());
}

test.describe('Game 11 - Xếp Khối Thông Minh', () => {
  test('hiển thị bàn 16x10 và khối tự rơi từ trên xuống', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await waitForGame(page);

    await expect(page.locator('.block-cell')).toHaveCount(160);
    await expect(page.locator('.block-control')).toHaveCount(4);
    await expect(page.locator('#blockNext')).toBeVisible();

    const initial = await page.evaluate(() => window.BongGame11.getState());
    expect(initial.rows).toBe(16);
    expect(initial.cols).toBe(10);
    expect(initial.active.row).toBe(0);

    await expect.poll(async () => {
      const state = await page.evaluate(() => window.BongGame11.getState());
      return state.active.row;
    }, { timeout: 2500 }).toBeGreaterThan(initial.active.row);

    await pauseGame(page);
    expect(errors).toEqual([]);
  });

  test('nút trái, quay, phải và thả điều khiển được khối', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await waitForGame(page);
    await pauseGame(page);

    const initial = await page.evaluate(() => window.BongGame11.getState());
    expect(initial.active.id).toBe('tee4');

    await page.locator('#blockLeft').click();
    const afterLeft = await page.evaluate(() => window.BongGame11.getState());
    expect(afterLeft.active.col).toBe(initial.active.col - 1);

    await page.locator('#blockRotate').click();
    const afterRotate = await page.evaluate(() => window.BongGame11.getState());
    expect(afterRotate.active.cells).not.toEqual(afterLeft.active.cells);

    await page.locator('#blockRight').click();
    const afterRight = await page.evaluate(() => window.BongGame11.getState());
    expect(afterRight.active.col).toBe(afterRotate.active.col + 1);

    await page.locator('#blockDrop').click();
    const afterDrop = await page.evaluate(() => window.BongGame11.getState());
    expect(afterDrop.usedCells).toBe(4);
    expect(afterDrop.score).toBe(4);
    expect(afterDrop.active.id).toBe('el4');
    expect(errors).toEqual([]);
  });

  test('có thể chơi bằng bàn phím và focus rõ ràng', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await waitForGame(page);
    await pauseGame(page);

    const board = page.locator('#blockBoard');
    await board.focus();
    await expect(board).toBeFocused();

    const initial = await page.evaluate(() => window.BongGame11.getState());
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowUp');
    const moved = await page.evaluate(() => window.BongGame11.getState());
    expect(moved.active.col).toBeGreaterThanOrEqual(initial.active.col);
    expect(moved.active.cells).not.toEqual(initial.active.cells);

    await page.keyboard.press('Space');
    const state = await page.evaluate(() => window.BongGame11.getState());
    expect(state.usedCells).toBe(4);
    expect(state.score).toBe(4);
    expect(errors).toEqual([]);
  });

  test('các nút điều khiển chính đủ lớn để chạm trên mobile', async ({ page }) => {
    await waitForGame(page);
    await pauseGame(page);

    const selectors = ['.game11-home', '#blockReset', '.block-control'];
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
      await page.evaluate(() => window.BongGame11.pause());
      await expect(page.locator('.block-cell')).toHaveCount(160);
      await expect(page.locator('.block-control')).toHaveCount(4);
    } finally {
      await context.setOffline(false);
    }

    expect(errors).toEqual([]);
  });
});
