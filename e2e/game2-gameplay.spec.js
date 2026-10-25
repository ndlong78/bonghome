const { test, expect } = require('@playwright/test');

/*
 * Game 2 sau khi tách engine/UI: chạm bằng con trỏ thật lên hai bức tranh, chấm sai, gợi ý,
 * tìm đủ 5 điểm rồi thắng, bấm "Tranh mới" giữa chừng, khôi phục bản lưu cũ.
 */

async function openGame2(page) {
  await page.goto('/game2.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame2 && window.BongGamesAutosave));
}

/** Chạm bằng con trỏ thật vào điểm (x, y) theo toạ độ viewBox 300x300 của một bức tranh. */
async function tapPicture(page, pictureId, x, y) {
  const picture = page.locator(`#${pictureId}`);
  // Đưa tranh vào giữa màn hình: chạm sát mép trên không bị thanh cố định ở đầu trang che mất.
  await picture.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'center' }));
  const box = await picture.boundingBox();
  await page.mouse.click(box.x + (x / 300) * box.width, box.y + (y / 300) * box.height);
}

const differences = (page) => page.evaluate(() => window.BongGame2.getState().differences
  .map((id) => window.BongGame2Engine.objectById(id)));

test.describe('Game 2 – Tìm Điểm Khác Biệt', () => {
  test('tìm đủ 5 điểm trên cả hai tranh: chấm sai, gợi ý, thắng và ghi hoàn thành', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await openGame2(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const targets = await differences(page);
    // Tranh 2 thiếu đúng các vật "biến mất" trong số 5 điểm khác: cùng nền, cùng số vật còn lại.
    await expect(page.locator('#tranhA .lop-danh-dau')).toHaveCount(1);

    // Chấm vào nền trời trống: dấu X hiện thoáng qua, tính chấm sai.
    await tapPicture(page, 'tranhA', 150, 100);
    await expect(page.locator('#tranhA .dau-sai')).toHaveCount(1);
    await expect(page.locator('#tranhA .dau-sai')).toHaveCount(0, { timeout: 2000 });

    // Gợi ý khoanh vàng một điểm chưa tìm trên cả hai tranh.
    await page.locator('#nutGoiY').click();
    await expect(page.locator('#tranhA .goi-y')).toHaveCount(1);
    await expect(page.locator('#tranhB .goi-y')).toHaveCount(1);
    await expect(page.locator('#nutGoiY')).toHaveText('💡 Gợi ý (còn 1)');

    for (const [index, target] of targets.entries()) {
      await tapPicture(page, index % 2 ? 'tranhA' : 'tranhB', target.x, target.y);
      await expect(page.locator('#tranhA .vong-dung')).toHaveCount(index + 1);
      await expect(page.locator('#tranhB .vong-dung')).toHaveCount(index + 1);
      await expect(page.locator('#soTimDuoc')).toHaveText(`${index + 1}/5`);
    }

    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#saiCuoi')).toHaveText('1');
    await expect(page.locator('#bangKyLuc')).toHaveClass(/hien/);
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('⭐ Bé nhận 2 sao');
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('Bông hoa nhỏ');

    const saved = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('bonghome:data')).data.progress;
      return {
        completion: Object.values(progress.completions).find((item) => item.gameId === 'game2'),
        inProgress: Boolean(progress.games.game2),
        record: localStorage.getItem('kyluc_game2')
      };
    });
    expect(saved.completion).toEqual(expect.objectContaining({ gameId: 'game2', moves: 6, difficulty: '5-differences' }));
    expect(Number.isInteger(saved.completion.durationSeconds)).toBe(true);
    expect(saved.inProgress).toBe(false);
    expect(saved.record).not.toBeNull();
    expect(errors).toEqual([]);

    await page.locator('#nutChoiLai').click();
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(page.locator('#soTimDuoc')).toHaveText('0/5');
    await expect(page.locator('#tranhA .vong-dung')).toHaveCount(0);
    await expect(page.locator('#nutGoiY')).toHaveText('💡 Gợi ý (còn 2)');
    await expect(page.locator('#nutGoiY')).toBeEnabled();
  });

  test('chạm trong lúc chờ màn thắng không tính chấm sai; bấm "Tranh mới" thì không hiện màn thắng', async ({ page }) => {
    // Dừng đồng hồ: hẹn giờ 600 ms của màn thắng chỉ chạy khi test cho phép (máy chậm không làm test sai).
    await page.clock.install({ time: new Date('2026-10-25T08:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-25T08:00:01Z'));
    await page.goto('/game2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.BongGame2 && window.BongGamesAutosave), null, { polling: 50 });
    for (const [index, target] of (await differences(page)).entries()) {
      await tapPicture(page, 'tranhB', target.x, target.y);
      await expect(page.locator('#soTimDuoc')).toHaveText(`${index + 1}/5`);
    }
    await tapPicture(page, 'tranhA', 150, 100);
    expect(await page.evaluate(() => window.BongGame2.getState().wrong)).toBe(0);
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    // Bấm bằng con trỏ thật: nút âm thanh nổi và banner cài app không còn che "Tranh mới" trên iPhone.
    await page.locator('#nutVanMoi').click();
    await page.clock.runFor(1200);
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(page.locator('#soTimDuoc')).toHaveText('0/5');
  });

  test('khôi phục ván đang chơi dở từ bản lưu cũ (định dạng trước khi tách engine)', async ({ page }) => {
    const legacy = {
      schemaVersion: 1, sessionId: 'game2-legacy', differences: ['may', 'cay', 'nam', 'buom', 'matTroi'],
      found: ['nam', 'may'], wrong: 3, hintsLeft: 1, seconds: 64, started: true
    };
    await page.addInitScript((state) => {
      if (sessionStorage.getItem('game2-seeded')) return;
      sessionStorage.setItem('game2-seeded', '1');
      localStorage.setItem('bonghome:data', JSON.stringify({
        schemaVersion: 1,
        data: {
          progress: {
            schemaVersion: 1,
            completions: {},
            games: {
              game2: {
                status: 'in_progress', difficulty: '5-differences', theme: null, state,
                startedAt: '2026-10-25T00:00:00.000Z', updatedAt: '2026-10-25T00:00:00.000Z'
              }
            }
          }
        }
      }));
    }, legacy);
    await openGame2(page);

    await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
    await expect(page.locator('#soTimDuoc')).toHaveText('2/5');
    await expect(page.locator('#dongHo')).toHaveText(/^1:0[4-9]$/);
    await expect(page.locator('#nutGoiY')).toHaveText('💡 Gợi ý (còn 1)');
    await expect(page.locator('#tranhA .vong-dung')).toHaveCount(2);
    // Mặt trời ở tranh 2 là bản "khác" (màu hồng), ở tranh 1 là bản gốc (màu vàng).
    await expect(page.locator('#tranhB circle[cx="44"][cy="44"][r="20"]')).toHaveAttribute('fill', '#FFB7C5');
    await expect(page.locator('#tranhA circle[cx="44"][cy="44"][r="20"]')).toHaveAttribute('fill', '#FFE0A3');
    // Con trỏ bàn phím vẫn được gắn lại sau khi tranh vẽ lại.
    await expect(page.locator('#tranhA .bh-game2-keyboard-cursor')).toHaveCount(1);

    for (const [index, [x, y]] of [[256, 210], [236, 126], [44, 44]].entries()) {
      await tapPicture(page, 'tranhB', x, y);
      await expect(page.locator('#soTimDuoc')).toHaveText(`${index + 3}/5`);
    }
    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#saiCuoi')).toHaveText('3');
  });
});
