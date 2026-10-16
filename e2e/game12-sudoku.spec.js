const { test, expect } = require('@playwright/test');

function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function openGame(page) {
  await page.goto('/game12.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame12));
}

test.describe('Game 12 - Sudoku Vui Vẻ', () => {
  test('mở bàn 4×4 mặc định, điền hết bằng bảng chọn hình thì thắng', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.addInitScript(() => localStorage.removeItem('bonghome_game12_sudoku'));
    await openGame(page);

    await expect(page.locator('.sudoku-cell')).toHaveCount(16);
    await expect(page.locator('.sudoku-key')).toHaveCount(4);
    await expect(page.locator('.sudoku-level')).toHaveCount(3);

    const { givens, solution } = await page.evaluate(() => window.BongGame12.getState());
    for (let index = 0; index < givens.length; index += 1) {
      if (givens[index]) continue;
      await page.locator(`#sudokuCell${index}`).click();
      await page.locator(`.sudoku-key[data-value="${solution[index]}"]`).click();
    }

    await expect(page.locator('#sudokuWin')).toBeVisible();
    await expect(page.locator('#sudokuWinStars')).toHaveText('⭐⭐⭐');
    expect((await page.evaluate(() => window.BongGame12.getState())).solved).toBe(true);
    expect(errors).toEqual([]);
  });

  test('báo ô trùng, gợi ý và bàn phím hoạt động trên bàn 9×9', async ({ page }) => {
    await openGame(page);
    await page.locator('.sudoku-level[data-level="cay"]').click();
    await expect(page.locator('.sudoku-cell')).toHaveCount(81);
    await expect(page.locator('.sudoku-level[data-level="cay"]')).toHaveAttribute('aria-pressed', 'true');

    const state = await page.evaluate(() => window.BongGame12.getState());
    const empty = state.givens.findIndex((value) => !value);
    const row = Math.floor(empty / 9);
    const rowGiven = state.givens.slice(row * 9, row * 9 + 9).find(Boolean);

    await page.locator(`#sudokuCell${empty}`).click();
    await page.keyboard.press(String(rowGiven));
    await expect(page.locator(`#sudokuCell${empty}`)).toHaveClass(/conflict/);

    await page.keyboard.press('Backspace');
    await expect(page.locator(`#sudokuCell${empty}`)).not.toHaveClass(/conflict/);

    await page.locator('#sudokuHint').click();
    const after = await page.evaluate(() => window.BongGame12.getState());
    expect(after.values[empty]).toBe(state.solution[empty]);
    expect(after.hints).toBe(1);
    await expect(page.locator('#sudokuHints')).toHaveText('1');
  });

  test('giữ tiến độ khi tải lại trang', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.BongGame12.newGame('choi', 12345));
    const state = await page.evaluate(() => window.BongGame12.getState());
    const empty = state.givens.findIndex((value) => !value);
    await page.evaluate(([index, value]) => {
      window.BongGame12.select(index);
      window.BongGame12.place(value);
    }, [empty, state.solution[empty]]);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.BongGame12));
    const restored = await page.evaluate(() => window.BongGame12.getState());
    expect(restored.levelId).toBe('choi');
    expect(restored.givens).toEqual(state.givens);
    expect(restored.values[empty]).toBe(state.solution[empty]);
  });

  test('trang chủ có bảng Game 12 nằm sau Game 11 và ghi 12 lớp học', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const card = page.locator('[data-game12-card]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', 'game12.html');
    await expect(card).toContainText('Sudoku Vui Vẻ');
    await expect(page.locator('[data-game11-card] + [data-game12-card]')).toHaveCount(1);
    await expect(page.locator('.phu-de')).toContainText('12 lớp học');
    expect(errors).toEqual([]);
  });

  test('không tràn ngang trên màn hình nhỏ', async ({ page }) => {
    await openGame(page);
    for (const level of ['mam', 'choi', 'cay']) {
      await page.locator(`.sudoku-level[data-level="${level}"]`).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${level} không được tràn ngang`).toBeLessThanOrEqual(1);
    }
  });
});
