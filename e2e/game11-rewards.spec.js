const { test, expect } = require('@playwright/test');

/*
 * Game 11 ghi tiến độ và phần thưởng qua chính vòng chơi: hết bàn có dọn hàng thì tính
 * hoàn thành, bàn trắng thì không. Chuỗi khối được cố định (chỉ thanh dài 4 ô) để test lặp lại được.
 */

async function openDeterministicGame11(page) {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.route('**/content/games/game11.json', async (route) => {
    const response = await route.fetch();
    const content = await response.json();
    content.initialShapeIds = [];
    await route.fulfill({ response, json: content });
  });
  await page.goto('/game11.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame11));
  await page.evaluate(() => window.BongModulesReady);
  await page.evaluate(() => window.BongGame11.pause());
}

const repeat = (page, action, times) => page.evaluate(({ action, times }) => {
  for (let index = 0; index < times; index += 1) window.BongGame11[action]();
}, { action, times });

async function dropUntilGameOver(page) {
  await page.evaluate(() => {
    for (let index = 0; index < 200 && !window.BongGame11.getState().gameOver; index += 1) window.BongGame11.hardDrop();
  });
  expect(await page.evaluate(() => window.BongGame11.getState().gameOver)).toBe(true);
}

test.describe('Game 11 ghi tiến độ và phần thưởng khi hết bàn', () => {
  test('dọn được hàng: tính hoàn thành, cộng sao, mở sticker', async ({ page }) => {
    await openDeterministicGame11(page);
    expect(await page.evaluate(() => window.BongGame11.getState().active.id)).toBe('line4');

    // Hàng dưới cùng: thanh ngang ở cột 0-3 và 4-7, thanh dựng ở cột 9 rồi cột 8.
    await repeat(page, 'moveLeft', 10);
    await repeat(page, 'hardDrop', 1);
    await repeat(page, 'moveRight', 1);
    await repeat(page, 'hardDrop', 1);
    await repeat(page, 'rotate', 1);
    await repeat(page, 'moveRight', 10);
    await repeat(page, 'hardDrop', 1);
    await repeat(page, 'rotate', 1);
    await repeat(page, 'moveRight', 10);
    await repeat(page, 'moveLeft', 1);
    await repeat(page, 'hardDrop', 1);
    expect(await page.evaluate(() => window.BongGame11.getState().lines)).toBe(1);

    await dropUntilGameOver(page);
    await expect(page.locator('#blockStatus')).toContainText('Bé dọn được 1 hàng');
    await expect(page.locator('#blockStatus')).toContainText('⭐ Bé nhận 1 sao');
    await expect(page.locator('#blockStatus')).toContainText('Thợ xây khối nhí');

    const saved = await page.evaluate(() => ({
      completedByGame: window.BongProgress.getSummary().byGame.game11,
      inProgress: Boolean(window.BongProgress.getSummary().games.game11),
      reward: window.BongRewards.getByGameSummary().game11
    }));
    expect(saved).toEqual({
      completedByGame: 1,
      inProgress: false,
      reward: { stars: 1, stickerIds: ['block-builder'], badgeIds: [] }
    });

    // Góc phụ huynh hiện Game 11 với tên và phần thưởng từ catalog.
    await page.goto('/parents.html');
    await page.evaluate(() => window.BongModulesReady);
    const row = page.locator('.bh-parent-game-row', { hasText: 'Xếp Khối Thông Minh' });
    await expect(row).toContainText('1 lượt hoàn thành');
    await expect(row).toContainText('⭐ 1 sao');
    await expect(row).toContainText('🧱 Thợ xây khối nhí');
  });

  test('hết bàn mà chưa dọn hàng nào: không tính hoàn thành, không cộng sao', async ({ page }) => {
    await openDeterministicGame11(page);
    await dropUntilGameOver(page);
    expect(await page.evaluate(() => window.BongGame11.getState().lines)).toBe(0);
    await expect(page.locator('#blockStatus')).toContainText('Bàn đã đầy rồi');
    const saved = await page.evaluate(() => ({
      completed: window.BongProgress.getSummary().completed,
      stars: window.BongRewards.getSummary().stars
    }));
    expect(saved).toEqual({ completed: 0, stars: 0 });
  });
});
