const { test, expect } = require('@playwright/test');
const engine = require('../js/game8-engine.js');

/*
 * Game 8 sau khi tách engine/UI: đi hết mê cung bằng phím mũi tên, nút bấm và vuốt tay,
 * đụng tường, đổi mức độ, khôi phục bản lưu cũ (cả mức Khó 16x16) và ghi lượt hoàn thành.
 */

async function openGame8(page) {
  await page.goto('/game8.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.BongGame8 && window.BongGames810Autosave));
}

/** Đường ngắn nhất từ chỗ bé đứng về nhà, tính trên trạng thái thật của trang. */
function routeHome(page) {
  return page.evaluate(() => {
    const { size, maze, player } = window.BongGame8.getState();
    const moves = { len: [0, -1, 'tren'], phai: [1, 0, 'phai'], xuong: [0, 1, 'duoi'], trai: [-1, 0, 'trai'] };
    const previous = new Map([[`${player.x},${player.y}`, null]]);
    const queue = [[player.x, player.y]];
    while (queue.length) {
      const [x, y] = queue.shift();
      Object.entries(moves).forEach(([direction, [dx, dy, wall]]) => {
        const key = `${x + dx},${y + dy}`;
        if (maze[y][x][wall] || previous.has(key)) return;
        previous.set(key, [`${x},${y}`, direction]);
        queue.push([x + dx, y + dy]);
      });
    }
    const route = [];
    for (let key = `${size - 1},${size - 1}`; previous.get(key); key = previous.get(key)[0]) route.unshift(previous.get(key)[1]);
    return route;
  });
}

const KEYS = { len: 'ArrowUp', phai: 'ArrowRight', xuong: 'ArrowDown', trai: 'ArrowLeft' };

function seedProgress(page, state, difficulty) {
  return page.addInitScript(({ saved, level }) => {
    if (sessionStorage.getItem('game8-seeded')) return;
    sessionStorage.setItem('game8-seeded', '1');
    localStorage.setItem('bonghome:data', JSON.stringify({
      schemaVersion: 1,
      data: {
        progress: {
          schemaVersion: 1,
          completions: {},
          games: {
            game8: {
              status: 'in_progress',
              difficulty: level,
              theme: null,
              state: saved,
              startedAt: '2026-10-25T00:00:00.000Z',
              updatedAt: '2026-10-25T00:00:00.000Z'
            }
          }
        }
      }
    }));
  }, { saved: state, level: difficulty });
}

test.describe('Game 8 – Mê Cung Về Nhà', () => {
  test('đi hết mê cung: đụng tường không tính bước, thắng, ghi hoàn thành và phần thưởng', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await openGame8(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // Ô xuất phát luôn có tường phía trên.
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#soBuoc')).toHaveText('0');

    const route = await routeHome(page);
    expect(route.length).toBeGreaterThanOrEqual(14);
    for (const direction of route) await page.keyboard.press(KEYS[direction]);
    await expect(page.locator('#soBuoc')).toHaveText(String(route.length));

    await expect(page.locator('#manThang')).toHaveClass(/hien/);
    await expect(page.locator('#buocCuoi')).toHaveText(String(route.length));
    await expect(page.locator('#bangKyLuc')).toHaveClass(/hien/);
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('⭐ Bé nhận 2 sao');
    await expect(page.locator('.man-thang .bh-reward-summary')).toContainText('La bàn khám phá');

    // Về tới nhà rồi thì phím mũi tên không còn tác dụng.
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#soBuoc')).toHaveText(String(route.length));

    const saved = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('bonghome:data')).data.progress;
      return {
        completion: Object.values(progress.completions).find((item) => item.gameId === 'game8'),
        inProgress: Boolean(progress.games.game8),
        record: localStorage.getItem('kyluc_game8_8')
      };
    });
    expect(saved.completion).toEqual(expect.objectContaining({ gameId: 'game8', moves: route.length, difficulty: '8x8' }));
    expect(saved.inProgress).toBe(false);
    expect(saved.record).not.toBeNull();
    expect(errors).toEqual([]);

    await page.locator('#nutChoiLai').click();
    await expect(page.locator('#manThang')).not.toHaveClass(/hien/);
    await expect(page.locator('#soBuoc')).toHaveText('0');
    await expect(page.locator('#dongHo')).toHaveText('0:00');
  });

  test('nút mũi tên và vuốt tay trên mê cung đều di chuyển kỳ lân', async ({ page }) => {
    await openGame8(page);
    const [first, second] = await routeHome(page);
    const selector = { len: '.len', phai: '.phai', xuong: '.xuong', trai: '.trai' };
    await page.locator(`.phim-huong ${selector[first]}`).click();
    await expect(page.locator('#soBuoc')).toHaveText('1');

    const box = await page.locator('#meCung').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const [dx, dy] = { len: [0, -80], phai: [80, 0], xuong: [0, 80], trai: [-80, 0] }[second];
    await page.locator('#meCung').dispatchEvent('pointerdown', { clientX: cx, clientY: cy });
    await page.locator('#meCung').dispatchEvent('pointerup', { clientX: cx + dx, clientY: cy + dy });
    await expect(page.locator('#soBuoc')).toHaveText('2');
    // Chạm nhẹ (không vuốt) thì không đi.
    await page.locator('#meCung').dispatchEvent('pointerdown', { clientX: cx, clientY: cy });
    await page.locator('#meCung').dispatchEvent('pointerup', { clientX: cx + 5, clientY: cy + 5 });
    await expect(page.locator('#soBuoc')).toHaveText('2');
  });

  test('đổi mức độ tạo mê cung mới và cập nhật aria-pressed', async ({ page }) => {
    await openGame8(page);
    await page.locator('#mucDo button[data-o="16"]').click();
    expect(await page.evaluate(() => window.BongGame8.getState().size)).toBe(16);
    await expect(page.locator('#mucDo button[data-o="16"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#mucDo button[data-o="16"]')).toHaveClass(/dang-chon/);
    await expect(page.locator('#mucDo button[data-o="8"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#mucDo button[data-o="8"]')).not.toHaveClass(/dang-chon/);
  });

  for (const size of [8, 16]) {
    test(`khôi phục ván ${size}x${size} đang chơi dở từ bản lưu cũ (định dạng trước khi tách engine)`, async ({ page }) => {
      let seed = size;
      const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
      const game = engine.createGame(size, rng);
      const legacy = engine.serialize(game, `game8-legacy-${size}`);
      legacy.maze = legacy.maze.map((row) => row.map((cell) => ({ ...cell, tham: true })));
      Object.assign(legacy, { steps: 12, seconds: 75, started: true });
      await seedProgress(page, legacy, `${size}x${size}`);
      await openGame8(page);

      await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
      await expect(page.locator('#soBuoc')).toHaveText('12');
      await expect(page.locator('#dongHo')).toHaveText(/^1:1[5-9]$/);
      await expect(page.locator(`#mucDo button[data-o="${size}"]`)).toHaveAttribute('aria-pressed', 'true');
      const restored = await page.evaluate(() => window.BongGame8.getState());
      expect(restored.size).toBe(size);
      expect(restored.maze.map((row) => row.map(({ tren, phai, duoi, trai }) => ({ tren, phai, duoi, trai }))))
        .toEqual(game.maze.map((row) => row.map(({ tren, phai, duoi, trai }) => ({ tren, phai, duoi, trai }))));

      // Ván khôi phục chơi tiếp được tới đích.
      for (const direction of await routeHome(page)) await page.keyboard.press(KEYS[direction]);
      await expect(page.locator('#manThang')).toHaveClass(/hien/);
    });
  }
});
