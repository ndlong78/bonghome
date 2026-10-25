const { test, expect } = require('@playwright/test');

/*
 * Game 5 sau khi tách engine/UI: nối hết các chấm, chạm nhầm, bàn phím, vẽ lại giữa chừng,
 * đổi hình, khôi phục bản lưu cũ và ghi lượt hoàn thành kèm phần thưởng.
 */

async function openGame5(page) {
  await page.goto('/game5.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame5 && window.BongGames57Autosave));
}

const dots = (page) => page.locator('#lopDiem .diem');
const shapeIndex = (page) => page.evaluate(() => window.BongGame5.getState().shapeIndex);
/** Chọn sẵn một hình để test tất định (hình bốc ngẫu nhiên). */
const useShape = (page, index) => page.evaluate((shape) => window.BongGame5.restore({
  schemaVersion: 1, shapeIndex: shape, position: 0, wrong: 0, seconds: 0, started: false
}), index);

test.describe('Game 5 – Nối Điểm Theo Số', () => {
  test('nối hết các chấm: chạm nhầm được đếm, thắng, ghi hoàn thành và phần thưởng', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await openGame5(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await useShape(page, 1);
    const total = await dots(page).count();
    const name = await page.evaluate(() => window.BongGame5Engine.SHAPES[window.BongGame5.getState().shapeIndex].name);

    await dots(page).nth(2).click();
    await expect(dots(page).nth(2)).toHaveClass(/sai/);
    await expect(dots(page).nth(2)).not.toHaveClass(/sai/, { timeout: 2000 });
    await expect(page.locator('#chamKeTiep')).toHaveText('1');

    for (let index = 0; index < total; index += 1) {
      await expect(dots(page).nth(index)).toHaveClass(/ke-tiep/);
      await dots(page).nth(index).click();
      await expect(dots(page).nth(index)).toHaveClass(/xong/);
    }
    await expect(page.locator('#chamKeTiep')).toHaveText('✓');
    expect((await page.locator('#duongNoi').getAttribute('points')).split(' ')).toHaveLength(total);

    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#tieuDeThang')).toHaveText(`Đó là ${name}!`);
    await expect(page.locator('#saiCuoi')).toHaveText('1');
    await expect(page.locator('#hinhTo')).toHaveClass(/hien/);
    expect((await page.locator('#duongNoi').getAttribute('points')).split(' ')).toHaveLength(total + 1);
    await expect(page.locator('#bangKyLuc')).toHaveClass(/hien/);
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('⭐ Bé nhận 2 sao');
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('Bút chì chăm chỉ');

    const saved = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('bonghome:data')).data.progress;
      return {
        completion: Object.values(progress.completions).find((item) => item.gameId === 'game5'),
        inProgress: Boolean(progress.games.game5),
        record: localStorage.getItem('kyluc_game5')
      };
    });
    expect(saved.completion).toEqual(expect.objectContaining({ gameId: 'game5', moves: total + 1, difficulty: 'connect-the-dots' }));
    expect(saved.inProgress).toBe(false);
    expect(saved.record).not.toBeNull();
    expect(errors).toEqual([]);

    const before = await shapeIndex(page);
    await page.locator('#nutChoiLai').click();
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(page.locator('#chamKeTiep')).toHaveText('1');
    expect(await shapeIndex(page)).not.toBe(before);
  });

  test('chạm chấm bằng bàn phím (Enter và phím cách)', async ({ page }) => {
    await openGame5(page);
    await useShape(page, 1);
    await expect(dots(page).first()).toHaveAttribute('role', 'button');
    await dots(page).nth(1).focus();
    await page.keyboard.press(' ');
    await expect(dots(page).nth(1)).toHaveClass(/sai/);
    await dots(page).nth(0).focus();
    await page.keyboard.press('Enter');
    await expect(dots(page).nth(0)).toHaveClass(/xong/);
    await expect(page.locator('#chamKeTiep')).toHaveText('2');
  });

  test('bấm "Vẽ lại" ngay khi vừa nối xong thì không hiện màn thắng trên bảng mới', async ({ page }) => {
    await openGame5(page);
    await useShape(page, 1);
    const total = await dots(page).count();
    for (let index = 0; index < total; index += 1) await dots(page).nth(index).click();
    await page.locator('#nutLamLai').click();
    await page.waitForTimeout(1500);
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(page.locator('#hinhTo')).not.toHaveClass(/hien/);
    await expect(page.locator('#chamKeTiep')).toHaveText('1');
    await expect(page.locator('#lopDiem .diem.xong')).toHaveCount(0);
  });

  test('thuyền buồm: chạm vào chấm 1 bị chấm 4 đè lên vẫn nối được, cả hình chơi được bằng chạm thật', async ({ page }) => {
    await openGame5(page);
    await useShape(page, 4);
    // Chấm 4 vẽ sau, đè lên chấm 1: điểm trên cùng tại tâm chấm 1 thuộc về chấm 4.
    const topmost = await page.evaluate(() => {
      const circle = document.querySelector('#lopDiem .diem[data-i="0"] circle:not(.bh-game5-hit-target)');
      const box = circle.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2).closest('.diem').dataset.i;
    });
    expect(topmost).toBe('3');

    for (let index = 0; index < 9; index += 1) {
      const box = await dots(page).nth(index).locator('circle:not(.bh-game5-hit-target)').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.locator('#lopDiem .diem.xong')).toHaveCount(index + 1);
    }
    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#tieuDeThang')).toHaveText('Đó là Chiếc thuyền buồm!');
    await expect(page.locator('#saiCuoi')).toHaveText('0');
  });

  test('khôi phục hình đang nối dở từ bản lưu cũ (định dạng trước khi tách engine)', async ({ page }) => {
    const legacy = { schemaVersion: 1, sessionId: 'game5-legacy', shapeIndex: 2, position: 4, wrong: 3, seconds: 41, started: true };
    await page.addInitScript((state) => {
      if (sessionStorage.getItem('game5-seeded')) return;
      sessionStorage.setItem('game5-seeded', '1');
      localStorage.setItem('bonghome:data', JSON.stringify({
        schemaVersion: 1,
        data: {
          progress: {
            schemaVersion: 1,
            completions: {},
            games: {
              game5: {
                status: 'in_progress',
                difficulty: 'connect-the-dots',
                theme: null,
                state,
                startedAt: '2026-10-25T00:00:00.000Z',
                updatedAt: '2026-10-25T00:00:00.000Z'
              }
            }
          }
        }
      }));
    }, legacy);
    await openGame5(page);

    await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
    await expect(dots(page)).toHaveCount(9);
    await expect(page.locator('#chamKeTiep')).toHaveText('5');
    await expect(page.locator('#lopDiem .diem.xong')).toHaveCount(4);
    await expect(dots(page).nth(4)).toHaveClass(/ke-tiep/);
    await expect(page.locator('#dongHo')).toHaveText(/^0:4[1-9]$/);
    expect(await page.locator('#duongNoi').getAttribute('points')).toBe('40,210 110,140 210,120 300,170');
    // Vùng chạm lớn vẫn được thêm cho bảng khôi phục.
    await expect(page.locator('#lopDiem .bh-game5-hit-target')).toHaveCount(9);

    for (let index = 4; index < 9; index += 1) await dots(page).nth(index).click();
    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#tieuDeThang')).toHaveText('Đó là Con cá tung tăng!');
    await expect(page.locator('#saiCuoi')).toHaveText('3');
  });
});
