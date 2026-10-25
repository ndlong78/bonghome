const { test, expect } = require('@playwright/test');

/*
 * Game 9 sau khi tách engine/UI. Từ hiện theo hẹn giờ (0,9 giây chuẩn bị, mỗi từ 1,15 giây) nên test
 * điều khiển đồng hồ bằng page.clock để bấm đúng lúc một cách tất định.
 */

const READY_MS = 900;
const WORD_MS = 1150;

async function openGame9(page) {
  // Dừng đồng hồ trước khi mở trang: thời gian chỉ trôi khi test gọi runFor.
  await page.clock.install({ time: new Date('2026-10-25T08:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-25T08:00:01Z'));
  await page.goto('/game9.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame9 && window.BongGames810Autosave), null, { polling: 50 });
}

const story = (page) => page.evaluate(() => {
  const state = window.BongGame9.getState();
  return window.BongGame9Engine.STORIES[state.storyIndex];
});

test.describe('Game 9 – Nghe Truyện Tìm Từ', () => {
  test('nghe trọn chuyện: bắt đúng, bấm nhầm, bỏ lỡ, kết thúc và ghi hoàn thành', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await openGame9(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(page.locator('#nutBat')).toBeDisabled();

    await page.locator('#nutBatDau').click();
    await expect(page.locator('#chu')).toHaveText('Chuẩn bị…');
    // Bấm lúc "Chuẩn bị…" (chưa có từ nào hiện) thì không bị tính nhầm.
    await page.locator('#nutBat').click();
    await expect(page.locator('#soNham')).toHaveText('0');

    const { keyword, words } = await story(page);
    await expect(page.locator('#tuKhoa')).toHaveText(keyword);
    await page.clock.runFor(READY_MS);
    const keywordIndexes = words.map((word, index) => (word === keyword ? index : -1)).filter((index) => index >= 0);
    const skipped = keywordIndexes[1];
    for (let index = 0; index < words.length; index += 1) {
      await expect(page.locator('#chu')).toHaveText(words[index]);
      if (index === 0) {
        await page.keyboard.press(' '); // bấm nhầm ở từ đầu tiên
        await expect(page.locator('#soNham')).toHaveText('1');
      } else if (words[index] === keyword && index !== skipped) {
        if (index % 2) await page.keyboard.press(' ');
        else await page.locator('#nutBat').click();
      }
      await page.clock.runFor(WORD_MS);
    }

    const total = keywordIndexes.length;
    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#chu')).toHaveText('Hết chuyện!');
    await expect(page.locator('#dungCuoi')).toHaveText(`${total - 1}/${total}`);
    await expect(page.locator('#loCuoi')).toHaveText('1');
    await expect(page.locator('#diemCuoi')).toHaveText(String((total - 1) * 10 - 3 - 2));
    await expect(page.locator('#tieuDeThang')).toHaveText('Bé nghe giỏi lắm!');
    await expect(page.locator('#nutBat')).toBeDisabled();
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('⭐ Bé nhận 2 sao');
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('Cuốn sách kể chuyện');

    const saved = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('bonghome:data')).data.progress;
      return {
        completion: Object.values(progress.completions).find((item) => item.gameId === 'game9'),
        inProgress: Boolean(progress.games.game9),
        record: localStorage.getItem('kyluc_game9')
      };
    });
    expect(saved.completion).toEqual(expect.objectContaining({ gameId: 'game9', moves: total + 1, difficulty: 'keyword-story' }));
    expect(saved.inProgress).toBe(false);
    expect(saved.record).toBe(String((total - 1) * 10 - 5));
    expect(errors).toEqual([]);
  });

  test('phím cách bấm được nút đang chọn khi chưa kể chuyện, và là nút bắt từ khoá khi đang kể', async ({ page }) => {
    await openGame9(page);
    await page.locator('#nutBatDau').focus();
    await page.keyboard.press(' ');
    await expect(page.locator('#chu')).toHaveText('Chuẩn bị…');
    await expect(page.locator('#nutBat')).toBeEnabled();
    await page.clock.runFor(READY_MS);
    await page.keyboard.press(' ');
    await expect(page.locator('#soNham')).toHaveText('1');
  });

  test('khôi phục chuyện đang nghe dở từ bản lưu cũ (định dạng trước khi tách engine)', async ({ page }) => {
    const legacy = {
      schemaVersion: 1, sessionId: 'game9-legacy', storyIndex: 1, wordIndex: 20, caughtCurrent: false,
      correct: 2, missed: 1, wrong: 1, running: true, readAloud: true
    };
    await page.addInitScript((state) => {
      if (sessionStorage.getItem('game9-seeded')) return;
      sessionStorage.setItem('game9-seeded', '1');
      localStorage.setItem('bonghome:data', JSON.stringify({
        schemaVersion: 1,
        data: {
          progress: {
            schemaVersion: 1,
            completions: {},
            games: {
              game9: {
                status: 'in_progress', difficulty: 'keyword-story', theme: null, state,
                startedAt: '2026-10-25T00:00:00.000Z', updatedAt: '2026-10-25T00:00:00.000Z'
              }
            }
          }
        }
      }));
    }, legacy);
    await openGame9(page);

    await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
    await expect(page.locator('#tuKhoa')).toHaveText('HOA');
    await expect(page.locator('#chu')).toHaveText('Ong');
    await expect(page.locator('#soDung')).toHaveText('2');
    await expect(page.locator('#soLo')).toHaveText('1');
    await expect(page.locator('#soNham')).toHaveText('1');
    await expect(page.locator('#nutBat')).toBeEnabled();
    // Chuyện tiếp tục đúng nhịp từ chỗ dừng.
    await page.clock.runFor(WORD_MS);
    await expect(page.locator('#chu')).toHaveText('cũng');
  });
});
