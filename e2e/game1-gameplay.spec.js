const { test, expect } = require('@playwright/test');

/*
 * Game 1 sau khi tách engine/UI: lật bài bằng con trỏ thật, cặp sai úp lại, ghép đủ rồi thắng,
 * đổi mức giữa chừng không bị hẹn giờ của ván cũ làm hỏng ván mới, khôi phục bản lưu cũ.
 */

async function openGame1(page) {
  await page.goto('/game1.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame1 && window.BongGame1Autosave && window.BongGame1Content), null, { polling: 50 });
}

/** Chạm bằng con trỏ thật vào giữa lá thứ `index`. */
async function tapCard(page, index) {
  const card = page.locator('#sanBai .la-bai').nth(index);
  await card.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'center' }));
  const box = await card.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Chỉ số hai lá của từng mã hình trong bộ bài đang chơi. */
const pairsOf = (page) => page.evaluate(() => {
  const map = new Map();
  window.BongGame1.getState().deck.forEach((code, index) => map.set(code, [...(map.get(code) || []), index]));
  return [...map.values()];
});

const cards = (page) => page.locator('#sanBai .la-bai');

test.describe('Game 1 – Lật Hình Tìm Cặp', () => {
  test('lật bài: cặp sai úp lại, ghép đủ 3 cặp thì thắng và ghi hoàn thành', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openGame1(page);
    const [[a1, a2], [b1, b2], [c1, c2]] = await pairsOf(page);

    // Cặp sai: hai lá đỏ lên rồi tự úp lại, tính 1 lượt; lá thứ ba không lật được trong lúc chờ.
    await expect(cards(page).nth(a1)).toHaveAttribute('aria-pressed', 'false');
    await tapCard(page, a1);
    await expect(cards(page).nth(a1)).toHaveAttribute('aria-label', `Lá bài ${a1 + 1}, đang mở`);
    await expect(cards(page).nth(a1)).toHaveAttribute('aria-pressed', 'true');
    await tapCard(page, b1);
    await expect(cards(page).nth(a1)).toHaveClass(/sai/);
    await expect(page.locator('#soLuot')).toHaveText('1');
    await tapCard(page, c1);
    await expect(cards(page).nth(c1)).not.toHaveClass(/lat/);
    await expect(cards(page).nth(a1)).not.toHaveClass(/lat/, { timeout: 3000 });
    await expect(cards(page).nth(b1)).not.toHaveClass(/lat/);
    // Lớp trợ năng bàn phím vẫn đồng bộ nhãn theo trạng thái lá.
    await expect(cards(page).nth(a1)).toHaveAttribute('aria-label', `Lá bài ${a1 + 1}, đang úp`);

    for (const [index, [first, second]] of [[a1, a2], [b1, b2], [c1, c2]].entries()) {
      await tapCard(page, first);
      await tapCard(page, second);
      await expect(cards(page).nth(second)).toHaveClass(/dung/);
      await expect(page.locator('#soCap')).toHaveText(`${index + 1}/3`);
    }
    await expect(cards(page).nth(a2)).toBeDisabled();
    await expect(cards(page).nth(a2)).toHaveAttribute('aria-label', `Lá bài ${a2 + 1}, đã ghép đúng`);

    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#luotCuoi')).toHaveText('4');
    await expect(page.locator('#bangKyLuc')).toHaveClass(/hien/);
    await expect(page.locator('#manThang .bh-game1-reward-summary')).toContainText('⭐ Bé nhận 1 sao');

    const saved = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('bonghome:data')).data.progress;
      return {
        completion: Object.values(progress.completions).find((item) => item.gameId === 'game1'),
        inProgress: Boolean(progress.games.game1),
        record: localStorage.getItem('kyluc_game1_3')
      };
    });
    expect(saved.completion).toEqual(expect.objectContaining({ gameId: 'game1', moves: 4, difficulty: '3' }));
    expect(saved.completion.transactionId).toMatch(/^bong-home:game1:3:/);
    expect(saved.inProgress).toBe(false);
    expect(saved.record).not.toBeNull();
    expect(errors).toEqual([]);

    await page.locator('#nutChoiLai').click();
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(page.locator('#soCap')).toHaveText('0/3');
    await expect(page.locator('#soLuot')).toHaveText('0');
    await expect(cards(page).locator('xpath=self::*[contains(@class,"lat")]')).toHaveCount(0);
  });

  test('mức Khó theo nội dung JSON: 24 lá, mỗi cặp cùng một hình', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await openGame1(page);
    await page.locator('#mucDo button').nth(2).click();
    await expect(page.locator('#mucDo button').nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page)).toHaveCount(24);
    await expect(page.locator('#soCap')).toHaveText('0/12');
    const faces = await page.evaluate(() => [...document.querySelectorAll('#sanBai .mat-truoc')].map((face) => face.innerHTML));
    const pairs = await pairsOf(page);
    expect(pairs).toHaveLength(12);
    for (const [first, second] of pairs) {
      expect(faces[first]).toContain('<svg');
      expect(faces[first]).toBe(faces[second]);
    }
    expect(new Set(faces).size).toBe(12);
  });

  test('đổi mức giữa chừng: hẹn giờ của ván cũ không làm hỏng ván mới, ván đã ghép đủ vẫn được ghi', async ({ page }) => {
    // Dừng đồng hồ: hẹn giờ úp lại (1 giây) và chờ màn thắng (0,7 giây) chỉ chạy khi test cho phép.
    await page.clock.install({ time: new Date('2026-10-25T08:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-25T08:00:01Z'));
    await page.addInitScript(() => localStorage.clear());
    await openGame1(page);

    // Cặp sai rồi đổi sang mức Vừa ngay; lật một lá ở ván mới, hẹn giờ úp lại của ván cũ không được úp lá này.
    let [[a1], [b1]] = await pairsOf(page);
    await tapCard(page, a1);
    await tapCard(page, b1);
    await page.locator('#mucDo button').nth(1).click();
    await expect(cards(page)).toHaveCount(12);
    [[a1]] = await pairsOf(page);
    await tapCard(page, a1);
    await page.clock.runFor(1500);
    await expect(cards(page).nth(a1)).toHaveClass(/lat/);
    expect(await page.evaluate(() => window.BongGame1.getState().open.length)).toBe(1);

    // Ghép đủ mức Dễ rồi bấm lại "Dễ" trước khi màn thắng hiện: ván mới không bị màn thắng đè lên.
    await page.locator('#mucDo button').nth(0).click();
    for (const [first, second] of await pairsOf(page)) {
      await tapCard(page, first);
      await tapCard(page, second);
    }
    await expect(page.locator('#soCap')).toHaveText('3/3');
    await page.locator('#mucDo button').nth(0).dispatchEvent('click');
    await page.clock.runFor(1500);
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(page.locator('#soCap')).toHaveText('0/3');
    // Lượt hoàn thành đã được ghi ngay khi ghép đủ, dù bé đổi ván trước khi màn thắng kịp hiện.
    const completions = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('bonghome:data')).data.progress.completions)
      .filter((item) => item.gameId === 'game1').map((item) => item.difficulty));
    expect(completions).toEqual(['3']);
  });

  test('khôi phục ván đang chơi dở từ bản lưu cũ (snapshot trước khi có gói chủ đề)', async ({ page }) => {
    // Bản lưu dạng cũ nhất: snapshot nằm thẳng trong progress, có một cặp sai đang chờ úp lại.
    const legacy = {
      version: 1, difficulty: 6, deck: [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0],
      matchedIndices: [0, 11, 2, 9], openIndices: [1, 3], moves: 5, seconds: 64, started: true, locked: true
    };
    await page.clock.install({ time: new Date('2026-10-25T08:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-25T08:00:01Z'));
    await page.addInitScript((state) => {
      if (sessionStorage.getItem('game1-seeded')) return;
      sessionStorage.setItem('game1-seeded', '1');
      localStorage.setItem('bonghome:data', JSON.stringify({
        schemaVersion: 1,
        data: {
          progress: {
            schemaVersion: 1,
            completions: {},
            games: {
              game1: {
                status: 'in_progress', difficulty: '6', theme: null, state,
                startedAt: '2026-10-25T00:00:00.000Z', updatedAt: '2026-10-25T00:00:00.000Z'
              }
            }
          }
        }
      }));
    }, legacy);
    await openGame1(page);

    await expect(page.locator('.bh-game1-resume')).toBeVisible();
    await page.locator('.bh-game1-continue').click();
    await expect(page.locator('.bh-game1-resume')).toHaveCount(0);
    await expect(page.locator('#mucDo button').nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page)).toHaveCount(12);
    await expect(page.locator('#soCap')).toHaveText('2/6');
    await expect(page.locator('#soLuot')).toHaveText('5');
    await expect(page.locator('#dongHo')).toHaveText('1:04');
    await expect(cards(page).nth(1)).toHaveClass(/sai/);
    // Cặp sai đang chờ tự úp lại sau khi khôi phục, rồi bé chơi tiếp được.
    await page.clock.runFor(800);
    await expect(cards(page).nth(1)).not.toHaveClass(/lat/);
    await tapCard(page, 1);
    await tapCard(page, 10);
    await expect(page.locator('#soCap')).toHaveText('3/6');

    // Bản lưu mới vẫn đúng định dạng snapshot cũ, nằm trong gói theo mức và theo chủ đề.
    const snapshot = await page.evaluate(() => {
      const record = JSON.parse(localStorage.getItem('bonghome:data')).data.progress.games.game1;
      return record.state.themes['bong-home'].state.snapshots['6'].snapshot;
    });
    expect(snapshot).toEqual(expect.objectContaining({
      version: 1, difficulty: 6, deck: legacy.deck, matchedIndices: [0, 11, 2, 9, 1, 10], openIndices: [], moves: 6, locked: false
    }));
  });
});
