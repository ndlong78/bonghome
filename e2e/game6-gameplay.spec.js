const { test, expect } = require('@playwright/test');

/*
 * Game 6 sau khi tách engine/UI: chơi trọn 5 vòng trên trang thật, chọn nhầm, bàn phím,
 * khôi phục bản lưu cũ và ghi lượt hoàn thành kèm phần thưởng.
 */

async function openGame6(page) {
  await page.goto('/game6.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame6 && window.BongGames57Autosave));
}

/** Chỉ số hai ô sinh đôi của vòng hiện tại, đọc từ DOM (data-ma). */
function twinIndexes(page) {
  return page.locator('#luoi .o-hinh').evaluateAll((cells) => {
    const codes = cells.map((cell) => cell.dataset.ma);
    const twin = codes.find((code, index) => codes.indexOf(code) !== index);
    return codes.map((code, index) => (code === twin ? index : -1)).filter((index) => index >= 0);
  });
}

async function solveRound(page, round) {
  const total = [12, 16, 20, 25, 30][round];
  await expect(page.locator('#luoi .o-hinh')).toHaveCount(total);
  await expect(page.locator('#soVong')).toHaveText(`${round + 1}/5`);
  const [first, second] = await twinIndexes(page);
  await page.locator('#luoi .o-hinh').nth(first).click();
  await page.locator('#luoi .o-hinh').nth(second).click();
  await expect(page.locator('#luoi .o-hinh.dung')).toHaveCount(2);
}

test.describe('Game 6 – Tìm Cặp Sinh Đôi', () => {
  test('chơi trọn 5 vòng: thắng, ghi hoàn thành, nhận sao và sticker', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await openGame6(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // Vòng 1: một lần chọn nhầm trước khi tìm đúng.
    const [first, second] = await twinIndexes(page);
    const other = [...Array(12).keys()].find((index) => index !== first && index !== second);
    await page.locator('#luoi .o-hinh').nth(first).click();
    await expect(page.locator('#luoi .o-hinh').nth(first)).toHaveClass(/chon/);
    await page.locator('#luoi .o-hinh').nth(other).click();
    await expect(page.locator('#luoi .o-hinh.sai')).toHaveCount(2);
    await expect(page.locator('#luoi .o-hinh.chon')).toHaveCount(0);

    for (let round = 0; round < 5; round += 1) await solveRound(page, round);

    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#saiCuoi')).toHaveText('1');
    await expect(page.locator('#bangKyLuc')).toHaveClass(/hien/);
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('⭐ Bé nhận 2 sao');
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('Đôi bạn thân');

    const saved = await page.evaluate(() => ({
      completion: window.BongProgress.listCompletions?.().find((item) => item.gameId === 'game6')
        || Object.values(JSON.parse(localStorage.getItem('bonghome:data')).data.progress.completions).find((item) => item.gameId === 'game6'),
      inProgress: Boolean(JSON.parse(localStorage.getItem('bonghome:data')).data.progress.games.game6),
      record: localStorage.getItem('kyluc_game6')
    }));
    expect(saved.completion).toEqual(expect.objectContaining({ gameId: 'game6', moves: 6 }));
    expect(Number.isInteger(saved.completion.durationSeconds)).toBe(true);
    expect(saved.inProgress).toBe(false);
    expect(saved.record).not.toBeNull();
    expect(errors).toEqual([]);

    // Chơi lại: ván mới bắt đầu từ vòng 1, hộp thoại đóng.
    await page.locator('#nutChoiLai').click();
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(page.locator('#soVong')).toHaveText('1/5');
    await expect(page.locator('#luoi .o-hinh')).toHaveCount(12);
  });

  test('chọn ô bằng bàn phím (Enter và phím cách)', async ({ page }) => {
    await openGame6(page);
    const [first, second] = await twinIndexes(page);
    await page.locator('#luoi .o-hinh').nth(first).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#luoi .o-hinh').nth(first)).toHaveClass(/chon/);
    await page.locator('#luoi .o-hinh').nth(second).focus();
    await page.keyboard.press(' ');
    await expect(page.locator('#luoi .o-hinh.dung')).toHaveCount(2);
    await expect(page.locator('#thongBao')).toHaveText('Đúng rồi! Hai bạn sinh đôi đây!');
    await expect(page.locator('#soVong')).toHaveText('2/5');
  });

  test('khôi phục ván đang chơi dở từ bản lưu cũ (định dạng trước khi tách engine)', async ({ page }) => {
    const legacyCells = ['0-0', '1-1', '2-2', '3-3', '4-4', '5-5', '6-0', '7-1', '0-2', '1-3', '2-4', '3-5', '4-0', '5-1', '6-2', '2-2'];
    await page.addInitScript((cells) => {
      if (sessionStorage.getItem('game6-seeded')) return;
      sessionStorage.setItem('game6-seeded', '1');
      localStorage.setItem('bonghome:data', JSON.stringify({
        schemaVersion: 1,
        data: {
          progress: {
            schemaVersion: 1,
            completions: {},
            games: {
              game6: {
                status: 'in_progress',
                difficulty: '5-rounds',
                theme: null,
                state: { schemaVersion: 1, sessionId: 'game6-legacy', round: 1, cells, selectedIndex: 4, wrong: 3, seconds: 75, started: true },
                startedAt: '2026-10-24T00:00:00.000Z',
                updatedAt: '2026-10-24T00:00:00.000Z'
              }
            }
          }
        }
      }));
    }, legacyCells);
    await openGame6(page);

    await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
    await expect(page.locator('#soVong')).toHaveText('2/5');
    await expect(page.locator('#dongHo')).toHaveText(/^1:1[5-9]$/);
    expect(await page.locator('#luoi .o-hinh').evaluateAll((cells) => cells.map((cell) => cell.dataset.ma))).toEqual(legacyCells);
    await expect(page.locator('#luoi .o-hinh').nth(4)).toHaveClass(/chon/);

    // Ván khôi phục chơi tiếp được: chọn ô thứ hai của cặp 2-2 là tìm đúng.
    await page.locator('#luoi .o-hinh').nth(4).click();
    await page.locator('#luoi .o-hinh').nth(2).click();
    await page.locator('#luoi .o-hinh').nth(15).click();
    await expect(page.locator('#luoi .o-hinh.dung')).toHaveCount(2);
    await expect(page.locator('#soVong')).toHaveText('3/5');
  });
});
