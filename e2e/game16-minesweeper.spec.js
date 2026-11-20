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
  await page.goto('/game16.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame16));
}

const getState = (page) => page.evaluate(() => window.BongGame16.getState());
const cell = (page, index) => page.locator(`#mineCell${index}`);

/** Mở hết các ô không có tổ ong bằng cách bấm thật vào từng ô (ván đã bắt đầu). */
async function clearGarden(page) {
  let state = await getState(page);
  for (let index = 0; index < state.cells.length; index += 1) {
    state = await getState(page);
    if (state.status !== 'playing') break;
    if (state.cells[index] === 0 && state.counts[index] !== -1) await cell(page, index).click();
  }
  return getState(page);
}

test.describe('Game 16 - Dò Ong Trong Vườn', () => {
  test('ô đầu an toàn, mở lan; mở hết vườn thì thắng 3 sao, nhận sticker; hiện trong Góc phụ huynh và Bộ sưu tập', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('bh-test-cleared')) {
        localStorage.clear();
        sessionStorage.setItem('bh-test-cleared', '1');
      }
    });
    await openGame(page);
    await page.waitForFunction(() => window.BongGame16RewardsReady);
    await expect(page.locator('.mine-cell')).toHaveCount(64);
    await page.evaluate(() => window.BongGame16.newGame({ levelId: 'de', seed: 11 }));
    expect((await getState(page)).status).toBe('ready');

    await cell(page, 27).click();
    let state = await getState(page);
    expect(state.status).toBe('playing');
    expect(state.counts[27]).toBe(0);
    expect(state.cells.filter((value) => value === 1).length).toBeGreaterThan(4);
    await expect(cell(page, 27)).toHaveClass(/open/);
    await expect.poll(() => page.evaluate(() => window.BongProgress.getSummary().inProgress)).toBe(1);

    state = await clearGarden(page);
    expect(state.status).toBe('won');
    await expect(page.locator('#mineWin')).toBeVisible();
    await expect(page.locator('#mineWinTitle')).toHaveText('Bé tìm ra hết tổ ong rồi!');
    await expect(page.locator('#mineWinStars')).toHaveText('⭐⭐⭐');
    const rewardsBox = page.locator('#mineWinRewards');
    await expect(rewardsBox).toContainText('⭐ Bé nhận 3 sao');
    await expect(rewardsBox).toContainText('Ong chăm chỉ');
    await expect(page.locator('.mine-cell.flagged')).toHaveCount(8);
    await expect(page.locator('#mineBest')).not.toHaveText('--');

    const summary = await page.evaluate(() => ({ progress: window.BongProgress.getSummary(), rewards: window.BongRewards.getSummary() }));
    expect(summary.progress.byGame.game16).toBe(1);
    expect(summary.progress.inProgress).toBe(0);
    expect(summary.rewards.stickerIds).toContain('busy-bee');

    await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
    const row = page.locator('.bh-parent-game-row', { hasText: 'Dò Ong Trong Vườn' });
    await expect(row).toContainText('1 lượt hoàn thành');
    await expect(row).toContainText('🐝 Ong chăm chỉ');
    await page.goto('/collection.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Ong chăm chỉ')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('cấp Dễ: lỡ mở tổ ong thì Gấu Bông cứu; cấp Vừa mở tổ ong thì thua, lộ hết tổ ong, không cộng thưởng', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.BongGame16.newGame({ levelId: 'de', seed: 5 }));
    await cell(page, 0).click();
    let state = await getState(page);
    const bee = state.mines[0];
    await cell(page, bee).click();
    state = await getState(page);
    expect(state.status).toBe('playing');
    expect(state.rescuesLeft).toBe(0);
    expect(state.cells[bee]).toBe(2);
    await expect(page.locator('#mineStatus')).toContainText('Gấu Bông đã cứu bé');

    await page.locator('.mine-level[data-level="vua"]').click();
    await expect(page.locator('.mine-cell')).toHaveCount(100);
    await expect(page.locator('#mineRescue')).toBeHidden();
    await cell(page, 0).click();
    state = await getState(page);
    await cell(page, state.mines[0]).click();
    state = await getState(page);
    expect(state.status).toBe('lost');
    await expect(page.locator('#mineWin')).toBeVisible();
    await expect(page.locator('#mineWinTitle')).toHaveText('Ối, bé mở trúng tổ ong!');
    await expect(page.locator('#mineWinRewards')).toBeHidden();
    await expect(page.locator('.mine-cell.exploded')).toHaveCount(1);
    // Lộ cả 15 tổ ong (kể cả ô vừa mở trúng, tô đỏ).
    await expect(page.locator('.mine-cell.bee')).toHaveCount(15);
    await page.locator('#mineWinNext').click();
    expect((await getState(page)).status).toBe('ready');
  });

  test('cắm cờ bằng chuột phải, phím F và chế độ cờ; ô có cờ không mở được; bàn phím mũi tên chọn ô', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.BongGame16.newGame({ levelId: 'de', seed: 3 }));
    await cell(page, 0).click();
    let state = await getState(page);
    const hidden = state.cells.map((value, index) => (value === 0 ? index : -1)).filter((index) => index >= 0);
    const [a, b, c] = hidden;

    await cell(page, a).click({ button: 'right' });
    await expect(cell(page, a)).toHaveText('🚩');
    await expect(page.locator('#mineLeft')).toHaveText('7');
    await cell(page, a).click();
    expect((await getState(page)).cells[a]).toBe(2);

    await page.locator('#mineMode').click();
    await expect(page.locator('#mineMode')).toHaveAttribute('aria-pressed', 'true');
    await cell(page, b).click();
    await expect(cell(page, b)).toHaveText('🚩');
    await page.locator('#mineMode').click();

    await cell(page, c).focus();
    await page.keyboard.press('f');
    await expect(cell(page, c)).toHaveText('🚩');
    await page.keyboard.press('f');
    await expect(cell(page, c)).toHaveText('');
    await page.keyboard.press('ArrowRight');
    const focused = await page.evaluate(() => Number(document.activeElement?.dataset.index));
    expect(focused).toBe(Math.floor(c / 8) * 8 + ((c % 8) + 1) % 8);
  });

  test('màn cảm ứng: nhấn giữ một ô thì cắm cờ, nhấc tay ra không mở ô đó', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.BongGame16.newGame({ levelId: 'de', seed: 3 }));
    await cell(page, 0).click();
    const state = await getState(page);
    const target = state.cells.findIndex((value) => value === 0);
    const item = cell(page, target);
    await item.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 3, isPrimary: true });
    await expect(item).toHaveText('🚩', { timeout: 2000 });
    await item.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 3, isPrimary: true });
    await item.dispatchEvent('click');
    expect((await getState(page)).cells[target]).toBe(2);
  });

  test('gợi ý tô một ô an toàn và trừ lượt; thắng có dùng gợi ý thì 2 sao', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.BongGame16.newGame({ levelId: 'de', seed: 21 }));
    await cell(page, 27).click();
    await page.locator('#mineHint').click();
    const state = await getState(page);
    expect(state.hintsLeft).toBe(2);
    expect(state.counts[state.hint]).not.toBe(-1);
    await expect(cell(page, state.hint)).toHaveClass(/hint/);
    await expect(page.locator('#mineHint')).toHaveText('💡 Gợi ý (2)');
    const done = await clearGarden(page);
    expect(done.status).toBe('won');
    await expect(page.locator('#mineWinStars')).toHaveText('⭐⭐☆');
  });

  test('giữ ván đang chơi khi tải lại trang', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.BongGame16.newGame({ levelId: 'vua', seed: 8 }));
    await cell(page, 55).click();
    const before = await getState(page);
    const hidden = before.cells.findIndex((value) => value === 0);
    await cell(page, hidden).click({ button: 'right' });
    const saved = await getState(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.BongGame16));
    const restored = await getState(page);
    expect(restored.levelId).toBe('vua');
    expect(restored.status).toBe('playing');
    expect(restored.cells).toEqual(saved.cells);
    expect(restored.mines).toEqual(saved.mines);
    await expect(page.locator('#mineStatus')).toContainText('Tiếp tục ván đang chơi');
  });

  test('trang chủ có bảng Game 16 nằm sau Game 15 và ghi 16 lớp học', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    const card = page.locator('[data-game16-card]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', 'game16.html');
    await expect(card).toContainText('Dò Ong Trong Vườn');
    await expect(page.locator('[data-game15-card] + [data-game16-card]')).toHaveCount(1);
    await expect(page.locator('.phu-de')).toContainText('16 lớp học');
    expect(errors).toEqual([]);
  });

  test('vườn 12×12 nằm gọn màn hình nhỏ, không tràn ngang', async ({ page }) => {
    await openGame(page);
    await page.locator('.mine-level[data-level="kho"]').click();
    await expect(page.locator('.mine-cell')).toHaveCount(144);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const layout = await page.locator('.mine-cell').evaluateAll((cells) => {
      const rects = cells.map((item) => item.getBoundingClientRect());
      return {
        columns: new Set(rects.map((rect) => Math.round(rect.left))).size,
        minSide: Math.min(...rects.map((rect) => Math.min(rect.width, rect.height)))
      };
    });
    expect(layout.columns).toBe(12);
    expect(layout.minSide).toBeGreaterThanOrEqual(26);
  });
});
