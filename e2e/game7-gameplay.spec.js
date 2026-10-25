const { test, expect } = require('@playwright/test');

/*
 * Game 7 sau khi tách engine/UI: chơi trọn 8 câu trên trang thật, chọn sai (kể cả sai liên tiếp),
 * chỉ đếm câu đúng ngay lần đầu, bàn phím, khôi phục bản lưu cũ và ghi lượt hoàn thành kèm phần thưởng.
 */

async function openGame7(page) {
  await page.goto('/game7.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame7 && window.BongGames57Autosave));
}

/** Chỉ số lựa chọn đúng và hai lựa chọn sai của câu hiện tại. */
function choiceIndexes(page) {
  return page.evaluate(() => {
    const state = window.BongGame7.getState();
    const same = (a, b) => a.h === b.h && a.m === b.m;
    const correct = state.choices.findIndex((choice) => same(choice, state.answer));
    const wrong = state.choices.map((_, index) => index).filter((index) => index !== correct);
    return { correct, wrong };
  });
}

test.describe('Game 7 – Đoán Hình Tiếp Theo', () => {
  test('chơi trọn 8 câu: thắng, ghi hoàn thành, nhận sao và sticker', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await openGame7(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const choices = page.locator('#luaChon .nut-chon');

    // Câu 1: chọn sai hai lần liên tiếp, cả hai hình đều hết viền đỏ sau đó.
    const first = await choiceIndexes(page);
    await choices.nth(first.wrong[0]).click();
    await choices.nth(first.wrong[1]).click();
    await expect(page.locator('#thongBao')).toHaveText('Bé nhìn lại chuỗi hình xem nhé!');
    await expect(page.locator('#luaChon .nut-chon.sai')).toHaveCount(2);
    await expect(page.locator('#luaChon .nut-chon.sai')).toHaveCount(0, { timeout: 3000 });

    for (let question = 0; question < 8; question += 1) {
      await expect(page.locator('#soCau')).toHaveText(`${question + 1}/8`);
      await expect(page.locator('#chuoi .o-hoi')).toHaveText('?');
      const { correct } = await choiceIndexes(page);
      await choices.nth(correct).click();
      await expect(page.locator('#chuoi .o-hoi.da-dien svg')).toHaveCount(1);
      // Câu 1 đã chọn sai trước nên không tính "đúng ngay"; các câu sau chọn đúng ngay lần đầu.
      await expect(page.locator('#soDung')).toHaveText(String(question));
    }

    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#dungCuoi')).toHaveText('7/8');
    await expect(page.locator('#bangKyLuc')).toHaveClass(/hien/);
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('⭐ Bé nhận 2 sao');
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('Bóng đèn thông minh');

    const saved = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('bonghome:data')).data.progress;
      return {
        completion: Object.values(progress.completions).find((item) => item.gameId === 'game7'),
        inProgress: Boolean(progress.games.game7),
        record: localStorage.getItem('kyluc_game7')
      };
    });
    expect(saved.completion).toEqual(expect.objectContaining({ gameId: 'game7', moves: 9 }));
    expect(Number.isInteger(saved.completion.durationSeconds)).toBe(true);
    expect(saved.inProgress).toBe(false);
    expect(saved.record).not.toBeNull();
    expect(errors).toEqual([]);

    await page.locator('#nutChoiLai').click();
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(page.locator('#soCau')).toHaveText('1/8');
    await expect(page.locator('#soDung')).toHaveText('0');
  });

  test('chọn hình bằng bàn phím (Enter và phím cách)', async ({ page }) => {
    await openGame7(page);
    const choices = page.locator('#luaChon .nut-chon');
    const { correct, wrong } = await choiceIndexes(page);
    await choices.nth(wrong[0]).focus();
    await page.keyboard.press(' ');
    await expect(choices.nth(wrong[0])).toHaveClass(/sai/);
    await choices.nth(correct).focus();
    await page.keyboard.press('Enter');
    await expect(choices.nth(correct)).toHaveClass(/dung/);
    await expect(page.locator('#thongBao')).toHaveText('Chính xác! Quy luật đúng rồi!');
    await expect(page.locator('#soCau')).toHaveText('2/8');
  });

  test('tải lại trang sau khi chọn sai: câu đó vẫn không tính là đúng ngay', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('game7-cleared')) return;
      sessionStorage.setItem('game7-cleared', '1');
      localStorage.clear();
    });
    await openGame7(page);
    const choices = page.locator('#luaChon .nut-chon');
    const { wrong } = await choiceIndexes(page);
    await choices.nth(wrong[0]).click();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.BongGame7 && window.BongGames57Autosave));

    await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
    const { correct } = await choiceIndexes(page);
    await choices.nth(correct).click();
    await expect(page.locator('#thongBao')).toHaveText('Chính xác! Quy luật đúng rồi!');
    await expect(page.locator('#soDung')).toHaveText('0');
    await expect(page.locator('#soCau')).toHaveText('2/8');
  });

  test('khôi phục ván đang chơi dở từ bản lưu cũ (định dạng trước khi tách engine)', async ({ page }) => {
    const legacy = {
      schemaVersion: 1,
      sessionId: 'game7-legacy',
      question: 3,
      correct: 3,
      sequence: [{ h: 0, m: 0 }, { h: 0, m: 0 }, { h: 4, m: 2 }, { h: 0, m: 0 }, { h: 0, m: 0 }, { h: 4, m: 2 }, { h: 0, m: 0 }, { h: 0, m: 0 }],
      answer: { h: 4, m: 2 },
      choices: [{ h: 0, m: 0 }, { h: 4, m: 2 }, { h: 7, m: 5 }, { h: 2, m: 1 }],
      seconds: 48,
      started: true
    };
    await page.addInitScript((state) => {
      if (sessionStorage.getItem('game7-seeded')) return;
      sessionStorage.setItem('game7-seeded', '1');
      localStorage.setItem('bonghome:data', JSON.stringify({
        schemaVersion: 1,
        data: {
          progress: {
            schemaVersion: 1,
            completions: {},
            games: {
              game7: {
                status: 'in_progress',
                difficulty: '8-patterns',
                theme: null,
                state,
                startedAt: '2026-10-24T00:00:00.000Z',
                updatedAt: '2026-10-24T00:00:00.000Z'
              }
            }
          }
        }
      }));
    }, legacy);
    await openGame7(page);

    await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
    await expect(page.locator('#soCau')).toHaveText('4/8');
    await expect(page.locator('#soDung')).toHaveText('3');
    await expect(page.locator('#chuoi .o-chuoi:not(.o-hoi)')).toHaveCount(8);
    const fills = await page.locator('#luaChon .nut-chon path').evaluateAll((paths) => paths.map((path) => path.getAttribute('fill')));
    expect(fills).toEqual(['#FFB7C5', '#A8E6CF', '#FFCBA4', '#FFE0A3']);

    // Ván khôi phục chơi tiếp được: lựa chọn thứ hai là đáp án.
    await page.locator('#luaChon .nut-chon').nth(1).click();
    await expect(page.locator('#soDung')).toHaveText('4');
    await expect(page.locator('#soCau')).toHaveText('5/8');
  });
});
