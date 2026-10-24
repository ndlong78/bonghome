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
  await page.goto('/game13.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame13));
}

const getState = (page) => page.evaluate(() => window.BongGame13.getState());

test.describe('Game 13 - Cờ Ca-rô Tí Hon', () => {
  test('chơi với bạn: xếp ba hình hàng ngang thì thắng, tô sáng đường thắng, không cộng thưởng', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.addInitScript(() => localStorage.removeItem('bonghome_game13_tictactoe'));
    await openGame(page);

    await expect(page.locator('.ttt-cell')).toHaveCount(9);
    await expect(page.locator('.ttt-mode')).toHaveCount(2);
    await page.locator('.ttt-mode[data-mode="friend"]').click();
    await expect(page.locator('.ttt-mode[data-mode="friend"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tttLevels')).toBeHidden();
    await page.evaluate(() => window.BongGame13.newGame({ starter: 1 }));

    for (const index of [0, 3, 1, 4, 2]) await page.locator(`#tttCell${index}`).click();

    await expect(page.locator('#tttWin')).toBeVisible();
    await expect(page.locator('#tttWinTitle')).toHaveText('Bạn 🌸 thắng!');
    await expect(page.locator('#tttWinRewards')).toBeHidden();
    await expect(page.locator('.ttt-cell.win')).toHaveCount(3);
    const state = await getState(page);
    expect(state.result).toEqual({ winner: 1, line: [0, 1, 2] });
    expect(state.score).toEqual({ player: 1, draw: 0, bot: 0 });
    await expect(page.locator('#tttScorePlayer')).toHaveText('1');

    await page.locator('#tttWinNext').click();
    await expect(page.locator('#tttWin')).toBeHidden();
    expect((await getState(page)).starter).toBe(2);
    expect(errors).toEqual([]);
  });

  test('cấp Khó: bé chơi hoàn hảo thì hòa, nhận sao + sticker + huy hiệu, hiện trong Góc phụ huynh và Bộ sưu tập', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('bh-test-cleared')) {
        localStorage.clear();
        sessionStorage.setItem('bh-test-cleared', '1');
      }
    });
    await openGame(page);
    await page.waitForFunction(() => window.BongGame13RewardsReady);
    await page.locator('.ttt-level[data-level="kho"]').click();
    await expect(page.locator('.ttt-level[data-level="kho"]')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.BongGame13.newGame({ starter: 1, seed: 13 }));

    let state = await getState(page);
    let firstMove = true;
    while (!state.result) {
      expect(state.turn).toBe(1);
      const move = await page.evaluate((board) => window.BongTicTacToeEngine.bestMoves(board, 1)[0], state.board);
      await page.locator(`#tttCell${move}`).click();
      if (firstMove) {
        await expect.poll(() => page.evaluate(() => window.BongProgress.getSummary().inProgress)).toBe(1);
        firstMove = false;
      }
      await expect.poll(async () => {
        const next = await getState(page);
        return Boolean(next.result) || next.turn === 1;
      }).toBe(true);
      state = await getState(page);
    }

    expect(state.result.winner).toBe(0);
    await expect(page.locator('#tttWin')).toBeVisible();
    await expect(page.locator('#tttWinStars')).toHaveText('⭐⭐⭐');
    const rewardsBox = page.locator('#tttWinRewards');
    await expect(rewardsBox).toBeVisible();
    await expect(rewardsBox).toContainText('⭐ Bé nhận 3 sao');
    await expect(rewardsBox).toContainText('Cáo tinh nhanh');
    await expect(rewardsBox).toContainText('Kỳ thủ Ca-rô nhí');

    const summary = await page.evaluate(() => ({
      progress: window.BongProgress.getSummary(),
      rewards: window.BongRewards.getSummary()
    }));
    expect(summary.progress.byGame.game13).toBe(1);
    expect(summary.progress.inProgress).toBe(0);
    expect(summary.rewards.stars).toBe(3);
    expect(summary.rewards.stickerIds).toContain('clever-fox');
    expect(summary.rewards.badgeIds).toContain('tictactoe-master');

    await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
    const row = page.locator('.bh-parent-game-row', { hasText: 'Cờ Ca-rô Tí Hon' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('1 lượt hoàn thành');
    await expect(row).toContainText('⭐ 3 sao');
    await expect(row).toContainText('🦊 Cáo tinh nhanh');
    await expect(row).toContainText('🏅 Kỳ thủ Ca-rô nhí');

    await page.goto('/collection.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Cáo tinh nhanh')).toBeVisible();
    await expect(page.getByText('Kỳ thủ Ca-rô nhí')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Gấu Bông tự đi khi được đi trước; bàn phím số và mũi tên hoạt động; ô đã có hình không đổi', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await openGame(page);
    await page.evaluate(() => window.BongGame13.newGame({ levelId: 'vua', mode: 'bot', starter: 2, seed: 7 }));

    await expect.poll(async () => (await getState(page)).board.filter(Boolean).length).toBe(1);
    let state = await getState(page);
    expect(state.turn).toBe(1);
    const botCell = state.board.findIndex(Boolean);
    expect(state.board[botCell]).toBe(2);

    await page.locator(`#tttCell${botCell}`).click({ force: true });
    expect((await getState(page)).board[botCell]).toBe(2);

    const free = state.board.findIndex((value) => !value);
    await page.locator(`#tttCell${free}`).focus();
    await page.keyboard.press('ArrowRight');
    const focused = await page.evaluate(() => Number(document.activeElement?.dataset.index));
    expect(focused).toBe(Math.floor(free / 3) * 3 + ((free % 3) + 1) % 3);

    const target = state.board.findIndex((value, index) => !value && index !== focused);
    await page.keyboard.press(String(target + 1));
    state = await getState(page);
    expect(state.board[target]).toBe(1);
    await expect(page.locator(`#tttCell${target}`)).toHaveText('🌸');
    expect(errors).toEqual([]);
  });

  test('giữ ván đang chơi và tỉ số khi tải lại trang', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.BongGame13.newGame({ levelId: 'de', mode: 'bot', starter: 1, seed: 3 }));
    await page.locator('#tttCell4').click();
    await expect.poll(async () => (await getState(page)).turn).toBe(1);
    const before = await getState(page);
    expect(before.board.filter(Boolean)).toHaveLength(2);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.BongGame13));
    const restored = await getState(page);
    expect(restored.levelId).toBe('de');
    expect(restored.mode).toBe('bot');
    expect(restored.board).toEqual(before.board);
    expect(restored.matchId).toBe(before.matchId);
    expect(restored.turn).toBe(1);
  });

  test('trang chủ có bảng Game 13 nằm sau Game 12 và ghi 13 lớp học', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const card = page.locator('[data-game13-card]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', 'game13.html');
    await expect(card).toContainText('Cờ Ca-rô Tí Hon');
    await expect(page.locator('[data-game12-card] + [data-game13-card]')).toHaveCount(1);
    await expect(page.locator('.phu-de')).toContainText('13 lớp học');
    expect(errors).toEqual([]);
  });

  test('không tràn ngang trên màn hình nhỏ ở cả hai chế độ', async ({ page }) => {
    await openGame(page);
    for (const mode of ['bot', 'friend']) {
      await page.locator(`.ttt-mode[data-mode="${mode}"]`).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${mode} không được tràn ngang`).toBeLessThanOrEqual(1);
    }
    const box = await page.locator('#tttCell0').boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});
