const { test, expect } = require('@playwright/test');

/*
 * Game 3 sau khi tách engine/UI: kéo thả bằng con trỏ thật, thả nhầm, thả ra ngoài, thắng,
 * bấm "Ván mới" giữa chừng, khôi phục bản lưu cũ và ghi lượt hoàn thành kèm phần thưởng.
 */

async function openGame3(page) {
  await page.goto('/game3.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame3 && window.BongGamesAutosave));
}

const piece = (page, id) => page.locator(`#khay .mieng-hinh[data-id="${id}"]`);
const shadow = (page, id) => page.locator(`#hangBong .o-bong[data-id="${id}"]`);

async function center(locator) {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Kéo hình bằng con trỏ thật: nhấn, di qua vài bước, thả tại `to`. Lúc kéo, game3-drag-stability.js giữ chiều cao
 * khay; thả ra thì khung hình sau mới nhả, khay co lại và hàng bóng dịch lên. Chờ khay nhả xong để toạ độ của lần
 * kéo sau đo trên bố cục mới (máy CI chậm hơn thì khung hình sau đến muộn).
 */
async function drag(page, from, to) {
  await from.scrollIntoViewIfNeeded();
  const start = await center(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('#khay')).not.toHaveAttribute('data-bh-drag-layout-locked', 'true');
}

const colorOrder = (page) => page.evaluate(() => window.BongGame3.getState().colorOrder);

test.describe('Game 3 – Tìm Bóng Cho Hình', () => {
  test('kéo hết 6 hình: thả nhầm được đếm, thả ra ngoài thì không, thắng và ghi hoàn thành', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await openGame3(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const ids = await colorOrder(page);

    // Thả nhầm sang bóng của hình khác.
    await drag(page, piece(page, ids[0]), await center(shadow(page, ids[1])));
    await expect(shadow(page, ids[1])).toHaveClass(/sai/);
    await expect(shadow(page, ids[1])).not.toHaveClass(/sai/, { timeout: 2000 });
    // Thả ra ngoài hàng bóng: không tính nhầm.
    const box = await page.locator('#hangBong').boundingBox();
    await drag(page, piece(page, ids[0]), { x: box.x + box.width / 2, y: box.y - 120 });
    expect(await page.evaluate(() => window.BongGame3.getState().wrong)).toBe(1);

    for (let index = 0; index < ids.length; index += 1) {
      await drag(page, piece(page, ids[index]), await center(shadow(page, ids[index])));
      await expect(piece(page, ids[index])).toHaveClass(/xong/);
      await expect(shadow(page, ids[index])).toHaveClass(/dung/);
      await expect(page.locator('#soDung')).toHaveText(`${index + 1}/6`);
    }

    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#saiCuoi')).toHaveText('1');
    await expect(page.locator('#bangKyLuc')).toHaveClass(/hien/);
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('⭐ Bé nhận 2 sao');
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('Bạn cầu vồng');

    const saved = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('bonghome:data')).data.progress;
      return {
        completion: Object.values(progress.completions).find((item) => item.gameId === 'game3'),
        inProgress: Boolean(progress.games.game3),
        record: localStorage.getItem('kyluc_game3')
      };
    });
    expect(saved.completion).toEqual(expect.objectContaining({ gameId: 'game3', moves: 7, difficulty: '6-shapes' }));
    expect(Number.isInteger(saved.completion.durationSeconds)).toBe(true);
    expect(saved.inProgress).toBe(false);
    expect(saved.record).not.toBeNull();
    expect(errors).toEqual([]);

    await page.locator('#nutChoiLai').click();
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(page.locator('#soDung')).toHaveText('0/6');
    await expect(page.locator('#khay .mieng-hinh.xong')).toHaveCount(0);
  });

  test('bấm "Ván mới" ngay khi vừa ghép xong thì không hiện màn thắng trên ván mới', async ({ page }) => {
    await openGame3(page);
    const ids = await colorOrder(page);
    for (const id of ids) await drag(page, piece(page, id), await center(shadow(page, id)));
    await page.locator('#nutVanMoi').click();
    await page.waitForTimeout(1200);
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(page.locator('#soDung')).toHaveText('0/6');
    await expect(page.locator('#hangBong .o-bong.dung')).toHaveCount(0);
  });

  test('khôi phục ván đang chơi dở từ bản lưu cũ (định dạng trước khi tách engine)', async ({ page }) => {
    const legacy = {
      schemaVersion: 1,
      sessionId: 'game3-legacy',
      colorOrder: ['conCa', 'ngoiSao', 'chiecLa', 'traiTim', 'ngoiNha', 'caiNam'],
      shadowOrder: ['traiTim', 'caiNam', 'conCa', 'ngoiNha', 'ngoiSao', 'chiecLa'],
      matched: ['caiNam', 'ngoiSao'],
      wrong: 2,
      seconds: 37,
      started: true
    };
    await page.addInitScript((state) => {
      if (sessionStorage.getItem('game3-seeded')) return;
      sessionStorage.setItem('game3-seeded', '1');
      localStorage.setItem('bonghome:data', JSON.stringify({
        schemaVersion: 1,
        data: {
          progress: {
            schemaVersion: 1,
            completions: {},
            games: {
              game3: {
                status: 'in_progress',
                difficulty: '6-shapes',
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
    await openGame3(page);

    await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
    await expect(page.locator('#soDung')).toHaveText('2/6');
    await expect(page.locator('#dongHo')).toHaveText(/^0:3[7-9]$/);
    expect(await page.locator('#khay .mieng-hinh').evaluateAll((items) => items.map((item) => item.dataset.id))).toEqual(legacy.colorOrder);
    expect(await page.locator('#hangBong .o-bong').evaluateAll((items) => items.map((item) => item.dataset.id))).toEqual(legacy.shadowOrder);
    await expect(page.locator('#khay .mieng-hinh.xong')).toHaveCount(2);
    await expect(shadow(page, 'caiNam')).toHaveClass(/dung/);
    // Bóng đã ghép hiện hình màu, bóng chưa ghép vẫn là bóng mờ.
    await expect(shadow(page, 'caiNam').locator('path')).toHaveAttribute('fill', '#FF9FB3');
    await expect(shadow(page, 'conCa').locator('path')).toHaveAttribute('fill', '#8E7BA6');

    for (const id of ['conCa', 'chiecLa', 'traiTim', 'ngoiNha']) {
      await drag(page, piece(page, id), await center(shadow(page, id)));
      await expect(shadow(page, id)).toHaveClass(/dung/);
    }
    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#saiCuoi')).toHaveText('2');
  });
});
