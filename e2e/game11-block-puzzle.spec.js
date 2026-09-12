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
  test('hiển thị bàn 16x10 và khối tự rơi chậm từ trên xuống', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await waitForGame(page);

    await expect(page.locator('.block-cell')).toHaveCount(160);
    await expect(page.locator('.block-control')).toHaveCount(4);
    await expect(page.locator('#blockNext')).toBeVisible();

    const initial = await page.evaluate(() => window.BongGame11.getState());
    expect(initial.rows).toBe(16);
    expect(initial.cols).toBe(10);
    expect(initial.fallIntervalMs).toBe(1430);
    expect(initial.active.row).toBe(0);

    await expect.poll(async () => {
      const state = await page.evaluate(() => window.BongGame11.getState());
      return state.active.row;
    }, { timeout: 3500 }).toBeGreaterThan(initial.active.row);

    await pauseGame(page);
    expect(errors).toEqual([]);
  });

  test('rê chuột trái phải thì khối active đi theo con trỏ', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await waitForGame(page);
    await pauseGame(page);

    const board = page.locator('#blockBoard');
    const box = await board.boundingBox();
    expect(box).not.toBeNull();

    const initial = await page.evaluate(() => window.BongGame11.getState());
    expect(initial.active.id).toBe('tee4');

    await page.mouse.move(box.x + box.width * 0.08, box.y + box.height * 0.18);
    await expect.poll(async () => {
      const state = await page.evaluate(() => window.BongGame11.getState());
      return state.active.col;
    }).toBeLessThan(initial.active.col);

    const leftState = await page.evaluate(() => window.BongGame11.getState());

    await page.mouse.move(box.x + box.width * 0.92, box.y + box.height * 0.18);
    await expect.poll(async () => {
      const state = await page.evaluate(() => window.BongGame11.getState());
      return state.active.col;
    }).toBeGreaterThan(leftState.active.col);

    expect(errors).toEqual([]);
  });

  test('click trực tiếp lên bàn sẽ quay khối đang rơi', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await waitForGame(page);
    await pauseGame(page);

    const before = await page.evaluate(() => window.BongGame11.getState());
    expect(before.active.id).toBe('tee4');

    await page.locator('.block-cell[data-row="5"][data-col="5"]').click();

    const after = await page.evaluate(() => window.BongGame11.getState());
    expect(after.active.cells).not.toEqual(before.active.cells);
    await expect(page.locator('#blockBoard')).toBeFocused();
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

  test('mobile giữ nguyên viewport khi chạm và chơi, không làm màn hình trượt', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await waitForGame(page);
    await pauseGame(page);

    const before = await page.evaluate(() => ({
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      innerHeight: window.innerHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
      bodyPosition: getComputedStyle(document.body).position,
      bodyOverflow: getComputedStyle(document.body).overflow,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      boardTouchAction: getComputedStyle(document.getElementById('blockBoard')).touchAction
    }));

    expect(before.scrollX).toBe(0);
    expect(before.scrollY).toBe(0);
    expect(before.bodyPosition).toBe('fixed');
    expect(before.bodyOverflow).toBe('hidden');
    expect(before.htmlOverflow).toBe('hidden');
    expect(before.boardTouchAction).toBe('none');
    expect(before.scrollHeight).toBeLessThanOrEqual(before.clientHeight + 1);

    const viewportHeight = before.innerHeight;
    for (const selector of ['.game11-topbar', '#blockBoard', '.block-controls', '.game11-status']) {
      const box = await page.locator(selector).boundingBox();
      expect(box, `${selector} phải nằm trong viewport`).not.toBeNull();
      expect(box.y).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight + 1);
    }

    await page.locator('#blockLeft').click();
    await page.locator('#blockRotate').click();
    await page.locator('#blockRight').click();
    await page.locator('.block-cell[data-row="5"][data-col="5"]').click();
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(50);

    const after = await page.evaluate(() => ({
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight
    }));
    expect(after.scrollX).toBe(0);
    expect(after.scrollY).toBe(0);
    expect(after.scrollHeight).toBeLessThanOrEqual(after.clientHeight + 1);
    expect(errors).toEqual([]);
  });

  test('mobile giữ đủ 16 hàng bằng nhau và nút âm thanh không đè hàng điều khiển', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await waitForGame(page);
    await pauseGame(page);
    await page.waitForFunction(() => Boolean(document.querySelector('.nut-am-thanh')));

    const metrics = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('.block-cell'));
      const heights = Array.from({ length: 16 }, (_, row) => cells[row * 10].getBoundingClientRect().height);
      const widths = Array.from({ length: 10 }, (_, col) => cells[col].getBoundingClientRect().width);
      const sound = document.querySelector('.nut-am-thanh').getBoundingClientRect();
      const controls = document.querySelector('.block-controls').getBoundingClientRect();
      const status = document.querySelector('.game11-status').getBoundingClientRect();
      const firstCellStyle = getComputedStyle(cells[0]);
      return {
        heights,
        widths,
        sound: { x: sound.x, y: sound.y, width: sound.width, height: sound.height, bottom: sound.bottom },
        controls: { y: controls.y, bottom: controls.bottom },
        status: { y: status.y, bottom: status.bottom },
        transitionDuration: firstCellStyle.transitionDuration,
        gridTemplateRows: getComputedStyle(document.getElementById('blockBoard')).gridTemplateRows
      };
    });

    const minHeight = Math.min(...metrics.heights);
    const maxHeight = Math.max(...metrics.heights);
    const minWidth = Math.min(...metrics.widths);
    const maxWidth = Math.max(...metrics.widths);
    expect(metrics.heights).toHaveLength(16);
    expect(maxHeight - minHeight).toBeLessThanOrEqual(1);
    expect(maxWidth - minWidth).toBeLessThanOrEqual(1);
    expect(minHeight).toBeGreaterThan(10);
    expect(metrics.gridTemplateRows.split(/\s+/).filter(Boolean)).toHaveLength(16);
    expect(metrics.transitionDuration).toBe('0s');

    expect(metrics.sound.width).toBeGreaterThanOrEqual(44);
    expect(metrics.sound.height).toBeGreaterThanOrEqual(44);
    expect(metrics.sound.width).toBeLessThanOrEqual(48);
    expect(metrics.sound.height).toBeLessThanOrEqual(48);
    expect(metrics.sound.y).toBeGreaterThanOrEqual(metrics.controls.bottom - 1);
    expect(metrics.sound.y).toBeGreaterThanOrEqual(metrics.status.y - 1);
    expect(metrics.sound.bottom).toBeLessThanOrEqual(metrics.status.bottom + 1);
    expect(errors).toEqual([]);
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
      await expect(page.locator('#blockBoard')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }

    expect(errors).toEqual([]);
  });
});
