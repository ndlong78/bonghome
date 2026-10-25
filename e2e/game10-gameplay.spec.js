const { test, expect } = require('@playwright/test');

/*
 * Game 10 sau khi tách engine/UI. Game chạy theo thời gian thật nên test điều khiển đồng hồ
 * (page.clock: performance.now, requestAnimationFrame, setTimeout) để gõ đúng/lệch nhịp một cách tất định.
 */

async function openGame10(page) {
  // Dừng đồng hồ trước khi mở trang: thời gian chỉ trôi khi test gọi runFor, kể cả lúc trang đang tải.
  await page.clock.install({ time: new Date('2026-10-25T08:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-25T08:00:01Z'));
  await page.goto('/game10.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame10 && window.BongGames810Autosave), null, { polling: 50 });
}

/** Thời điểm (ms kể từ lúc bắt đầu bài) của các ngôi sao còn chưa xử lý. */
const pendingTimes = (page) => page.evaluate(() => window.BongGame10.getState().stars.filter((star) => !star.done).map((star) => star.time));
const elapsed = (page) => page.evaluate(() => window.BongGame10.elapsedMs());

/** Chạy đồng hồ tới đúng thời điểm `t` của bài (cộng `offset` ms) rồi gõ phím cách. */
async function tapAt(page, t, offset = 0) {
  const wait = t + offset - await elapsed(page);
  if (wait > 0) await page.clock.runFor(wait);
  await page.keyboard.press(' ');
}

test.describe('Game 10 – Gõ Phím Theo Nhịp', () => {
  test('gõ trọn bài: chấm điểm theo độ lệch, trượt cắt chuỗi, kết thúc và ghi hoàn thành', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await openGame10(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(page.locator('#nutGo')).toBeDisabled();

    await page.locator('#nutBatDau').click();
    await expect(page.locator('#nutGo')).toBeEnabled();
    await expect(page.locator('#conLai')).toHaveText('24');

    // Gõ sớm khi chưa có sao nào tới: chỉ báo, không trừ điểm.
    await page.keyboard.press(' ');
    await expect(page.locator('#chamDiem')).toHaveText('Sớm quá!');
    await expect(page.locator('#diem')).toHaveText('0');

    // Sao 1 trúng tuyệt đối, sao 2 lệch 150 ms ("Giỏi lắm!"), sao 3 để trượt.
    let times = await pendingTimes(page);
    await tapAt(page, times[0]);
    await expect(page.locator('#chamDiem')).toHaveText('Tuyệt vời!');
    await expect(page.locator('#diem')).toHaveText('102');
    await tapAt(page, times[1], 150);
    await expect(page.locator('#chamDiem')).toHaveText('Giỏi lắm!');
    await expect(page.locator('#diem')).toHaveText('166');
    await expect(page.locator('#chuoi')).toHaveText('2');
    await page.clock.runFor(times[2] + 400 - await elapsed(page));
    await expect(page.locator('#chamDiem')).toHaveText('Trượt rồi!');
    await expect(page.locator('#chuoi')).toHaveText('0');
    await expect(page.locator('#conLai')).toHaveText('21');

    // Gõ trúng các sao còn lại bằng nút trên màn hình (pointerdown) xen với phím cách.
    times = await pendingTimes(page);
    for (const [index, time] of times.entries()) {
      if (index % 2) {
        await page.clock.runFor(time - await elapsed(page));
        await page.locator('#nutGo').dispatchEvent('pointerdown');
      } else {
        await tapAt(page, time);
      }
    }
    await page.clock.runFor(1000);

    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#trungCuoi')).toHaveText('23/24');
    await expect(page.locator('#chuoiCuoi')).toHaveText('21');
    await expect(page.locator('#tieuDeThang')).toHaveText('Bé gõ hay quá!');
    await expect(page.locator('#nutGo')).toBeDisabled();
    await expect(page.locator('#bangKyLuc')).toHaveClass(/hien/);
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('⭐ Bé nhận 2 sao');
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('Nốt nhạc vui');

    const saved = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('bonghome:data')).data.progress;
      return {
        completion: Object.values(progress.completions).find((item) => item.gameId === 'game10'),
        inProgress: Boolean(progress.games.game10),
        record: localStorage.getItem('kyluc_game10'),
        score: window.BongGame10.getState().score
      };
    });
    expect(saved.completion).toEqual(expect.objectContaining({ gameId: 'game10', moves: 24, difficulty: '24-stars' }));
    expect(saved.inProgress).toBe(false);
    expect(saved.record).toBe(String(saved.score));
    await expect(page.locator('#diemCuoi')).toHaveText(String(saved.score));
    expect(errors).toEqual([]);
  });

  test('phím cách bấm được nút đang chọn khi chưa chơi, và là phím gõ nhịp khi đang chơi', async ({ page }) => {
    await openGame10(page);
    await page.locator('#nutBatDau').focus();
    await page.keyboard.press(' ');
    await expect(page.locator('#nutGo')).toBeEnabled();
    const [first] = await pendingTimes(page);
    await tapAt(page, first);
    await expect(page.locator('#chamDiem')).toHaveText('Tuyệt vời!');
    expect(await page.evaluate(() => window.BongGame10.getState().streak)).toBe(1);
  });

  test('khôi phục bài đang chơi dở từ bản lưu cũ (định dạng trước khi tách engine)', async ({ page }) => {
    const stars = Array.from({ length: 24 }, (_, i) => ({ luc: 1500 + i * 800, xong: i < 5, trung: i < 3 }));
    const legacy = {
      schemaVersion: 1, sessionId: 'game10-legacy', stars, elapsedMs: 5800,
      score: 310, streak: 0, longestStreak: 3, hits: 3, misses: 2, lastBeat: 5, running: true
    };
    await page.addInitScript((state) => {
      if (sessionStorage.getItem('game10-seeded')) return;
      sessionStorage.setItem('game10-seeded', '1');
      localStorage.setItem('bonghome:data', JSON.stringify({
        schemaVersion: 1,
        data: {
          progress: {
            schemaVersion: 1,
            completions: {},
            games: {
              game10: {
                status: 'in_progress', difficulty: '24-stars', theme: null, state,
                startedAt: '2026-10-25T00:00:00.000Z', updatedAt: '2026-10-25T00:00:00.000Z'
              }
            }
          }
        }
      }));
    }, legacy);
    await openGame10(page);

    await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
    await expect(page.locator('#diem')).toHaveText('310');
    await expect(page.locator('#conLai')).toHaveText('19');
    await expect(page.locator('#nutGo')).toBeEnabled();
    expect(await elapsed(page)).toBeGreaterThanOrEqual(5800);
    // Bài tiếp tục từ đúng chỗ dừng: sao thứ 6 (lúc 5500 ms) đã trượt, sao thứ 7 (6300 ms) gõ trúng.
    await tapAt(page, 6300);
    await expect(page.locator('#chamDiem')).toHaveText('Tuyệt vời!');
    await expect(page.locator('#conLai')).toHaveText('17');
  });
});
