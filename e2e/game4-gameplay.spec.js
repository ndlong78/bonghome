const { test, expect } = require('@playwright/test');

/*
 * Game 4 sau khi tách engine/UI: kéo đồ vật vào giỏ bằng con trỏ thật, bỏ nhầm giỏ, thả ra ngoài,
 * gom hết rồi thắng, bấm "Ván mới" giữa chừng và ghi lượt hoàn thành kèm phần thưởng.
 * Khôi phục bản lưu (cả bản rất cũ chỉ có HTML) nằm ở e2e/game4-autosave-restore.spec.js.
 */

async function openGame4(page) {
  await page.goto('/game4.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame4 && window.BongGamesAutosave));
}

const items = (page) => page.locator('#sanDo .do-vat');
const basket = (page, color) => page.locator(`#hangGio .gio[data-mau="${color}"]`);

async function center(locator) {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Kéo bằng con trỏ thật: nhấn, di qua vài bước, thả tại `to`. */
async function drag(page, from, to) {
  await from.scrollIntoViewIfNeeded();
  const start = await center(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

const colors = (page) => page.evaluate(() => window.BongGame4.getState().objects.map((item) => item.color));

test.describe('Game 4 – Gom Đồ Theo Màu', () => {
  test('gom hết 12 đồ vật: bỏ nhầm được đếm, thả ra ngoài thì không, thắng và ghi hoàn thành', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await openGame4(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const order = await colors(page);
    await expect(items(page)).toHaveCount(12);

    // Bỏ nhầm vào giỏ khác màu.
    const wrong = ['hong', 'vang', 'mint', 'tim'].find((color) => color !== order[0]);
    await drag(page, items(page).nth(0), await center(basket(page, wrong)));
    await expect(basket(page, wrong)).toHaveClass(/sai/);
    // Thả ra ngoài hàng giỏ: không tính nhầm.
    const box = await page.locator('#hangGio').boundingBox();
    await drag(page, items(page).nth(0), { x: box.x + box.width / 2, y: box.y - 140 });
    expect(await page.evaluate(() => window.BongGame4.getState().wrong)).toBe(1);

    const perBasket = { hong: 0, vang: 0, mint: 0, tim: 0 };
    for (let index = 0; index < 11; index += 1) {
      await drag(page, items(page).nth(index), await center(basket(page, order[index])));
      await expect(items(page).nth(index)).toHaveClass(/xong/);
      perBasket[order[index]] += 1;
      await expect(page.locator(`#dem-${order[index]}`)).toHaveText(String(perBasket[order[index]]));
      await expect(page.locator('#soGom')).toHaveText(`${index + 1}/12`);
    }
    await drag(page, items(page).nth(11), await center(basket(page, order[11])));
    await expect(page.locator('#sanDo .loi-het')).toHaveText('Sân đã sạch bong rồi!');
    await expect(page.locator('#soGom')).toHaveText('12/12');

    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#saiCuoi')).toHaveText('1');
    await expect(page.locator('#bangKyLuc')).toHaveClass(/hien/);
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('⭐ Bé nhận 2 sao');
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('Trái tim ấm áp');

    const saved = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('bonghome:data')).data.progress;
      return {
        completion: Object.values(progress.completions).find((item) => item.gameId === 'game4'),
        inProgress: Boolean(progress.games.game4),
        record: localStorage.getItem('kyluc_game4')
      };
    });
    expect(saved.completion).toEqual(expect.objectContaining({ gameId: 'game4', moves: 13, difficulty: '12-objects' }));
    expect(Number.isInteger(saved.completion.durationSeconds)).toBe(true);
    expect(saved.inProgress).toBe(false);
    expect(saved.record).not.toBeNull();
    expect(errors).toEqual([]);

    await page.locator('#nutChoiLai').click();
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(items(page)).toHaveCount(12);
    await expect(page.locator('#soGom')).toHaveText('0/12');
    await expect(page.locator('#dem-hong')).toHaveText('0');
  });

  test('bấm "Ván mới" ngay khi vừa gom xong thì không hiện màn thắng trên ván mới', async ({ page }) => {
    await openGame4(page);
    const order = await colors(page);
    for (let index = 0; index < 12; index += 1) {
      await drag(page, items(page).nth(index), await center(basket(page, order[index])));
      if (index < 11) await expect(items(page).nth(index)).toHaveClass(/xong/);
    }
    await page.locator('#nutVanMoi').click();
    await page.waitForTimeout(1200);
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(items(page)).toHaveCount(12);
    await expect(page.locator('#soGom')).toHaveText('0/12');
  });

  test('tải lại trang khi đang gom dở: đúng đồ vật đã gom, đúng số trong từng giỏ', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('game4-cleared')) return;
      sessionStorage.setItem('game4-cleared', '1');
      localStorage.clear();
    });
    await openGame4(page);
    const order = await colors(page);
    await drag(page, items(page).nth(0), await center(basket(page, order[0])));
    await drag(page, items(page).nth(1), await center(basket(page, order[1])));
    await expect(items(page).nth(1)).toHaveClass(/xong/);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.BongGame4 && window.BongGamesAutosave));

    await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
    expect(await colors(page)).toEqual(order);
    await expect(page.locator('#sanDo .do-vat.xong')).toHaveCount(2);
    await expect(page.locator('#soGom')).toHaveText('2/12');
    const expected = { hong: 0, vang: 0, mint: 0, tim: 0 };
    expected[order[0]] += 1;
    expected[order[1]] += 1;
    for (const [color, count] of Object.entries(expected)) await expect(page.locator(`#dem-${color}`)).toHaveText(String(count));
  });
});
