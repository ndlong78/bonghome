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
  await page.goto('/game15.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame15));
}

const getState = (page) => page.evaluate(() => window.BongGame15.getState());

test.describe('Game 15 - Bông Phiêu Lưu', () => {
  test('bàn phím: mũi tên phải chạy, mũi tên lên nhảy; P tạm dừng thì Bông đứng yên', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.addInitScript(() => localStorage.removeItem('bonghome_game15_adventure'));
    await openGame(page);
    await expect.poll(async () => (await getState(page)).player.onGround).toBe(true);
    const start = await getState(page);
    expect(start.levelId).toBe('vuon-hoa');
    expect(start.player.hearts).toBe(3);

    await page.locator('#advCanvas').click();
    await page.keyboard.down('ArrowRight');
    await expect.poll(async () => (await getState(page)).player.x).toBeGreaterThan(start.player.x + 1);
    await page.keyboard.up('ArrowRight');

    await page.keyboard.down('ArrowUp');
    await expect.poll(async () => (await getState(page)).player.y).toBeLessThan(start.player.y - 1);
    await page.keyboard.up('ArrowUp');
    await expect.poll(async () => (await getState(page)).player.onGround).toBe(true);

    await page.keyboard.press('p');
    await expect(page.locator('#advPause')).toHaveAttribute('aria-pressed', 'true');
    const paused = await getState(page);
    expect(paused.paused).toBe(true);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.up('ArrowRight');
    expect((await getState(page)).player.x).toBe(paused.player.x);
    await page.locator('#advPause').click();
    expect((await getState(page)).paused).toBe(false);
    expect(errors).toEqual([]);
  });

  test('nút cảm ứng: giữ ▶ để chạy, chạm Nhảy để nhảy', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.BongGame15.startLevel('vuon-hoa'));
    await expect.poll(async () => (await getState(page)).player.onGround).toBe(true);
    const before = await getState(page);
    const right = page.locator('[data-control="right"]');
    await right.dispatchEvent('pointerdown', { pointerId: 7, isPrimary: true });
    await expect(right).toHaveClass(/held/);
    await expect.poll(async () => (await getState(page)).player.x).toBeGreaterThan(before.player.x + 1);
    await right.dispatchEvent('pointerup', { pointerId: 7, isPrimary: true });
    await expect(right).not.toHaveClass(/held/);

    const jump = page.locator('[data-control="jump"]');
    await jump.dispatchEvent('pointerdown', { pointerId: 8, isPrimary: true });
    await expect.poll(async () => (await getState(page)).player.vy).toBeLessThan(0);
    await jump.dispatchEvent('pointerup', { pointerId: 8, isPrimary: true });
  });

  test('về tới nhà: hộp thoại thắng, sao + sticker + huy hiệu, Góc phụ huynh và Bộ sưu tập', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('bh-test-cleared')) {
        localStorage.clear();
        sessionStorage.setItem('bh-test-cleared', '1');
      }
    });
    await openGame(page);
    await page.waitForFunction(() => window.BongGame15RewardsReady);
    await page.locator('.adv-level[data-level="troi-may"]').click();
    await expect(page.locator('.adv-level[data-level="troi-may"]')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.BongGame15.pause());

    // Nhảy một cái để bắt đầu lượt chơi (Góc phụ huynh thấy "đang chơi dở"), rồi đặt Bông ngay trước nhà.
    await page.evaluate(() => window.BongGame15.stepFrames(10, { jump: true, jumpPressed: true }));
    await expect.poll(() => page.evaluate(() => window.BongProgress.getSummary().inProgress)).toBe(1);
    await page.evaluate(() => {
      window.BongGame15.stepFrames(60, {});
      window.BongGame15.debugPlace(94, 9);
      return window.BongGame15.stepFrames(120, { right: true });
    });

    const state = await getState(page);
    expect(state.finished).toBe(true);
    await expect(page.locator('#advWin')).toBeVisible();
    await expect(page.locator('#advWinTitle')).toHaveText('Bông về tới nhà rồi!');
    await expect(page.locator('#advWinStars')).toHaveText('⭐☆☆');
    await expect(page.locator('#advWinNext')).toContainText('Chơi lại từ màn đầu');
    const rewardsBox = page.locator('#advWinRewards');
    await expect(rewardsBox).toBeVisible();
    await expect(rewardsBox).toContainText('⭐ Bé nhận 1 sao');
    await expect(rewardsBox).toContainText('Đám mây vui');
    await expect(rewardsBox).toContainText('Nhà phiêu lưu nhí');
    await expect(page.locator('.adv-level[data-level="troi-may"]')).toContainText('⭐');

    const summary = await page.evaluate(() => ({
      progress: window.BongProgress.getSummary(),
      rewards: window.BongRewards.getSummary()
    }));
    expect(summary.progress.byGame.game15).toBe(1);
    expect(summary.progress.inProgress).toBe(0);
    expect(summary.rewards.stars).toBe(1);
    expect(summary.rewards.stickerIds).toContain('happy-cloud');
    expect(summary.rewards.badgeIds).toContain('adventure-hero');

    await page.locator('#advWinNext').click();
    await expect(page.locator('#advWin')).toBeHidden();
    expect((await getState(page)).levelId).toBe('vuon-hoa');

    await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
    const row = page.locator('.bh-parent-game-row', { hasText: 'Bông Phiêu Lưu' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('1 lượt hoàn thành');
    await expect(row).toContainText('☁️ Đám mây vui');
    await expect(row).toContainText('🗺️ Nhà phiêu lưu nhí');

    await page.goto('/collection.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Đám mây vui')).toBeVisible();
    await expect(page.getByText('Nhà phiêu lưu nhí')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('rơi xuống vực thì quay lại cờ lưu; tải lại trang vẫn giữ cờ lưu và sao đã nhặt', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('bh-test-cleared')) {
        localStorage.removeItem('bonghome_game15_adventure');
        sessionStorage.setItem('bh-test-cleared', '1');
      }
    });
    await openGame(page);
    await page.evaluate(() => window.BongGame15.pause());
    // Màn Vườn Hoa: cờ lưu ở cột 30; đi qua cờ rồi thả rơi xuống khe ở cột 43–44.
    const events = await page.evaluate(() => {
      window.BongGame15.debugPlace(28, 9);
      const reach = window.BongGame15.stepFrames(60, { right: true });
      window.BongGame15.debugPlace(43, 2);
      return reach.concat(window.BongGame15.stepFrames(120, {}));
    });
    expect(events).toContain('checkpoint');
    expect(events).toContain('fall');
    const state = await getState(page);
    expect(state.checkpointId).toBe('c30-9');
    expect(Math.round(state.player.x)).toBe(30);
    expect(state.player.hearts).toBe(3);
    expect(state.collected.length).toBeGreaterThan(0);
    await expect(page.locator('#advStatus')).toContainText('cờ lưu');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.BongGame15));
    const restored = await getState(page);
    expect(restored.levelId).toBe('vuon-hoa');
    expect(restored.runId).toBe(state.runId);
    expect(restored.checkpointId).toBe('c30-9');
    expect(restored.collected.sort()).toEqual(state.collected.sort());
    await expect(page.locator('#advStatus')).toContainText('Tiếp tục màn Vườn Hoa từ cờ lưu');

    await page.locator('#advRestart').click();
    const fresh = await getState(page);
    expect(fresh.checkpointId).toBeNull();
    expect(fresh.collected).toEqual([]);
    expect(fresh.runId).not.toBe(state.runId);
  });

  test('trang chủ có bảng Game 15 nằm sau Game 14 và ghi 15 lớp học', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    const card = page.locator('[data-game15-card]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('href', 'game15.html');
    await expect(card).toContainText('Bông Phiêu Lưu');
    await expect(page.locator('[data-game14-card] + [data-game15-card]')).toHaveCount(1);
    await expect(page.locator('.phu-de')).toContainText('15 lớp học');
    expect(errors).toEqual([]);
  });

  test('khung chơi và nút điều khiển nằm gọn màn hình, không tràn ngang; nút đủ lớn để chạm', async ({ page }) => {
    await openGame(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    for (const control of ['left', 'right', 'jump']) {
      const box = await page.locator(`[data-control="${control}"]`).boundingBox();
      expect(box.width, control).toBeGreaterThanOrEqual(60);
      expect(box.height, control).toBeGreaterThanOrEqual(60);
    }
    const canvas = await page.locator('#advCanvas').boundingBox();
    const pad = await page.locator('#advPad').boundingBox();
    expect(canvas.height).toBeGreaterThanOrEqual(200);
    expect(pad.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
  });
});
