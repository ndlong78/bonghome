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
  await page.goto('/game14.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame14));
}

const getState = (page) => page.evaluate(() => window.BongGame14.getState());
const SIZE = 10;
const at = (row, col) => row * SIZE + col;

/** Chờ tới khi ván xong hoặc lại đến lượt bé (Gấu Bông đi sau 450ms). */
async function waitForPlayerTurn(page) {
  await expect.poll(async () => {
    const next = await getState(page);
    return Boolean(next.result) || next.turn === 1;
  }).toBe(true);
  return getState(page);
}

test.describe('Game 14 - Cờ Caro Nối Năm', () => {
  test('chơi với bạn: xếp 5 hình hàng chéo thì thắng, tô sáng đường thắng, không cộng thưởng', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.addInitScript(() => localStorage.removeItem('bonghome_game14_caro'));
    await openGame(page);

    await expect(page.locator('.caro-cell')).toHaveCount(100);
    await page.locator('.caro-mode[data-mode="friend"]').click();
    await expect(page.locator('.caro-mode[data-mode="friend"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#caroLevels')).toBeHidden();
    await page.evaluate(() => window.BongGame14.newGame({ starter: 1 }));

    const xs = [at(1, 1), at(2, 2), at(3, 3), at(4, 4), at(5, 5)];
    const os = [at(1, 2), at(1, 3), at(1, 4), at(1, 5)];
    for (let step = 0; step < xs.length; step += 1) {
      await page.locator(`#caroCell${xs[step]}`).click();
      if (os[step] !== undefined) await page.locator(`#caroCell${os[step]}`).click();
    }

    await expect(page.locator('#caroWin')).toBeVisible();
    await expect(page.locator('#caroWinTitle')).toHaveText('Bạn ❌ thắng!');
    await expect(page.locator('#caroWinRewards')).toBeHidden();
    await expect(page.locator('.caro-cell.win')).toHaveCount(5);
    const state = await getState(page);
    expect(state.result).toEqual({ winner: 1, line: xs });
    expect(state.score).toEqual({ player: 1, draw: 0, bot: 0 });
    await expect(page.locator('#caroScorePlayer')).toHaveText('1');

    await page.locator('#caroWinNext').click();
    await expect(page.locator('#caroWin')).toBeHidden();
    expect((await getState(page)).starter).toBe(2);
    expect(errors).toEqual([]);
  });

  test('thắng Gấu Bông cấp Khó: nhận 3 sao + sticker + huy hiệu, hiện trong Góc phụ huynh và Bộ sưu tập', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('bh-test-cleared')) {
        localStorage.clear();
        sessionStorage.setItem('bh-test-cleared', '1');
      }
    });
    await openGame(page);
    await page.waitForFunction(() => window.BongGame14RewardsReady);
    await page.locator('.caro-level[data-level="kho"]').click();
    await expect(page.locator('.caro-level[data-level="kho"]')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.BongGame14.newGame({ starter: 1, seed: 14 }));

    // Gấu Bông cấp Khó chỉ cầm hòa người chơi giỏi, nên dựng sẵn thế "bốn mở" cho bé rồi cho bé đi nước quyết định.
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('bonghome_game14_caro'));
      const board = new Array(100).fill(0);
      [43, 44, 45].forEach((index) => { board[index] = 1; });
      [0, 9, 99].forEach((index) => { board[index] = 2; });
      saved.match = { ...saved.match, board, turn: 1, starter: 1, moves: 1, lastMove: 99 };
      localStorage.setItem('bonghome_game14_caro', JSON.stringify(saved));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.BongGame14));
    expect((await getState(page)).board.filter(Boolean)).toHaveLength(6);

    await page.locator(`#caroCell${at(4, 6)}`).click();
    await expect.poll(() => page.evaluate(() => window.BongProgress.getSummary().inProgress)).toBe(1);
    let state = await waitForPlayerTurn(page);
    // Gấu chặn một đầu của bốn mở; bé đi đầu còn lại để đủ 5.
    while (!state.result) {
      const move = await page.evaluate((board) => window.BongCaroEngine.winningMoves(board, { size: 10, winLength: 5 }, 1)[0], state.board);
      expect(move, 'bé phải còn nước thắng ngay').toBeGreaterThanOrEqual(0);
      await page.locator(`#caroCell${move}`).click();
      state = await waitForPlayerTurn(page);
    }

    expect(state.result.winner).toBe(1);
    expect(state.result.line).toHaveLength(5);
    await expect(page.locator('#caroWin')).toBeVisible();
    await expect(page.locator('#caroWinStars')).toHaveText('⭐⭐⭐');
    const rewardsBox = page.locator('#caroWinRewards');
    await expect(rewardsBox).toBeVisible();
    await expect(rewardsBox).toContainText('⭐ Bé nhận 3 sao');
    await expect(rewardsBox).toContainText('Sư tử dũng cảm');
    await expect(rewardsBox).toContainText('Cao thủ Caro');

    const summary = await page.evaluate(() => ({
      progress: window.BongProgress.getSummary(),
      rewards: window.BongRewards.getSummary()
    }));
    expect(summary.progress.byGame.game14).toBe(1);
    expect(summary.progress.inProgress).toBe(0);
    expect(summary.rewards.stars).toBe(3);
    expect(summary.rewards.stickerIds).toContain('brave-lion');
    expect(summary.rewards.badgeIds).toContain('caro-master');

    await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
    const row = page.locator('.bh-parent-game-row', { hasText: 'Cờ Caro Nối Năm' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('1 lượt hoàn thành');
    await expect(row).toContainText('⭐ 3 sao');
    await expect(row).toContainText('🦁 Sư tử dũng cảm');
    await expect(row).toContainText('🥇 Cao thủ Caro');

    await page.goto('/collection.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Sư tử dũng cảm')).toBeVisible();
    await expect(page.getByText('Cao thủ Caro')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Gấu Bông tự đi giữa bàn khi được đi trước; mũi tên di chuyển ô; ô đã có hình không đổi; gợi ý tô một ô trống', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await openGame(page);
    await page.evaluate(() => window.BongGame14.newGame({ levelId: 'vua', mode: 'bot', starter: 2, seed: 7 }));

    await expect.poll(async () => (await getState(page)).board.filter(Boolean).length).toBe(1);
    let state = await getState(page);
    expect(state.turn).toBe(1);
    expect(state.board[at(5, 4)]).toBe(2);
    expect(state.lastMove).toBe(at(5, 4));
    await expect(page.locator(`#caroCell${at(5, 4)}`)).toHaveClass(/last/);

    await page.locator(`#caroCell${at(5, 4)}`).click({ force: true });
    expect((await getState(page)).board[at(5, 4)]).toBe(2);

    await page.locator(`#caroCell${at(2, 9)}`).focus();
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => Number(document.activeElement?.dataset.index))).toBe(at(2, 0));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    expect(await page.evaluate(() => Number(document.activeElement?.dataset.index))).toBe(at(3, 9));
    await page.keyboard.press('Enter');
    state = await getState(page);
    expect(state.board[at(3, 9)]).toBe(1);
    await expect(page.locator(`#caroCell${at(3, 9)}`)).toHaveText('❌');

    state = await waitForPlayerTurn(page);
    await page.locator('#caroHint').click();
    state = await getState(page);
    expect(state.hint).toBeGreaterThanOrEqual(0);
    expect(state.board[state.hint]).toBe(0);
    await expect(page.locator(`#caroCell${state.hint}`)).toHaveClass(/hint/);
    expect(await page.evaluate(() => Number(document.activeElement?.dataset.index))).toBe(state.hint);
    expect(errors).toEqual([]);
  });

  test('giữ ván đang chơi và tỉ số khi tải lại trang', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.BongGame14.newGame({ levelId: 'de', mode: 'bot', starter: 1, seed: 3 }));
    await page.locator(`#caroCell${at(4, 4)}`).click();
    await waitForPlayerTurn(page);
    const before = await getState(page);
    expect(before.board.filter(Boolean)).toHaveLength(2);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.BongGame14));
    const restored = await getState(page);
    expect(restored.levelId).toBe('de');
    expect(restored.mode).toBe('bot');
    expect(restored.board).toEqual(before.board);
    expect(restored.matchId).toBe(before.matchId);
    expect(restored.lastMove).toBe(before.lastMove);
    expect(restored.turn).toBe(1);
  });

  test('trang chủ có bảng Game 14 nằm sau Game 13 và ghi 14 lớp học', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const card = page.locator('[data-game14-card]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', 'game14.html');
    await expect(card).toContainText('Cờ Caro Nối Năm');
    await expect(page.locator('[data-game13-card] + [data-game14-card]')).toHaveCount(1);
    await expect(page.locator('.phu-de')).toContainText('14 lớp học');
    expect(errors).toEqual([]);
  });

  test('bàn 10×10 nằm gọn màn hình nhỏ, không tràn ngang ở cả hai chế độ', async ({ page }) => {
    await openGame(page);
    for (const mode of ['bot', 'friend']) {
      await page.locator(`.caro-mode[data-mode="${mode}"]`).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${mode} không được tràn ngang`).toBeLessThanOrEqual(1);
    }
    const layout = await page.locator('.caro-cell').evaluateAll((cells) => {
      const round = (value) => Math.round(value);
      const rects = cells.map((cell) => cell.getBoundingClientRect());
      return {
        columns: new Set(rects.map((rect) => round(rect.left))).size,
        rows: new Set(rects.map((rect) => round(rect.top))).size,
        minSide: Math.min(...rects.map((rect) => Math.min(rect.width, rect.height)))
      };
    });
    expect(layout.columns).toBe(10);
    expect(layout.rows).toBe(10);
    expect(layout.minSide).toBeGreaterThanOrEqual(26);
  });
});
