const { test, expect } = require('@playwright/test');

/*
 * Game 4 lưu chỉ số kiểu đồ vật (mẫu trong js/game4-engine.js) chứ không lưu innerHTML. Bản lưu cũ chỉ có HTML
 * vẫn khôi phục được nếu khớp mẫu có sẵn; HTML lạ thì bỏ bản lưu thay vì chèn vào trang.
 */

async function openGame4(page) {
  await page.goto('/game4.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.BongModulesReady);
  await expect(page.locator('#sanDo .do-vat')).toHaveCount(12);
}

async function savedGame4(page) {
  return page.evaluate(() => window.BongProgress.loadGame('game4')?.state || null);
}

/**
 * Nạp bản lưu Game 4 cho lần mở trang kế tiếp. Ghi qua addInitScript (trước khi trang mới
 * chạy script) vì khi rời trang, autosave trong pagehide sẽ ghi đè mọi thứ nạp từ trang cũ.
 */
async function seedState(page, makeObject) {
  const objects = await page.evaluate((source) => {
    // Mẫu đồ vật và màu lấy từ engine (trước khi tách engine là biến toàn cục KIEU_DO, MAU của trang).
    const engine = window.BongGame4Engine;
    const KIEU_DO = Array.from({ length: engine.SHAPE_COUNT }, (_, shape) => (color) => engine.shapeSvg(shape, color.id));
    const MAU = engine.COLORS;
    const make = new Function('color', 'index', 'KIEU_DO', 'MAU', source);
    const list = [];
    MAU.forEach((color) => {
      for (let index = 0; index < 3; index += 1) list.push(make(color, index, KIEU_DO, MAU));
    });
    return list;
  }, makeObject);
  await page.addInitScript((seededObjects) => {
    const raw = JSON.parse(localStorage.getItem('bonghome:data') || '{"schemaVersion":1,"data":{}}');
    raw.data.progress = raw.data.progress || { schemaVersion: 1, games: {}, completions: {} };
    raw.data.progress.games = raw.data.progress.games || {};
    raw.data.progress.games.game4 = {
      status: 'in_progress',
      difficulty: '12-objects',
      theme: null,
      state: {
        schemaVersion: 1,
        sessionId: 'game4-seeded',
        objects: seededObjects,
        basketCounts: { hong: 0, vang: 0, mint: 0, tim: 0 },
        collected: 0,
        wrong: 0,
        seconds: 42,
        started: true
      },
      startedAt: '2026-10-24T00:00:00.000Z',
      updatedAt: '2026-10-24T00:00:00.000Z'
    };
    localStorage.setItem('bonghome:data', JSON.stringify(raw));
  }, objects);
}

test.describe('Game 4 khôi phục ván từ mẫu đồ vật, không từ HTML đã lưu', () => {
  test('bản lưu mới ghi chỉ số kiểu đồ vật, không ghi HTML', async ({ page }) => {
    await openGame4(page);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const state = await savedGame4(page);
    expect(state.objects).toHaveLength(12);
    for (const item of state.objects) {
      expect(item).not.toHaveProperty('html');
      expect(Number.isInteger(item.shape) && item.shape >= 0).toBe(true);
    }
    const domShapes = await page.locator('#sanDo .do-vat').evaluateAll((items) => items.map((item) => Number(item.dataset.kieu)));
    expect(state.objects.map((item) => item.shape)).toEqual(domShapes);
  });

  test('khôi phục đúng kiểu đồ vật, màu và nhãn đọc màn hình', async ({ page }) => {
    await openGame4(page);
    await seedState(page, 'return { color: color.id, shape: (index + MAU.indexOf(color)) % KIEU_DO.length, done: false };');
    await openGame4(page);
    await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
    await expect(page.locator('#dongHo')).toHaveText('0:42');
    const restored = await page.locator('#sanDo .do-vat').evaluateAll((items) => items.map((item) => ({
      color: item.dataset.mau,
      shape: Number(item.dataset.kieu),
      label: item.getAttribute('aria-label'),
      matchesTemplate: item.innerHTML === (() => {
        const holder = document.createElement('div');
        holder.innerHTML = window.BongGame4Engine.shapeSvg(Number(item.dataset.kieu), item.dataset.mau);
        return holder.innerHTML;
      })()
    })));
    expect(restored.map(({ color, shape }) => `${color}:${shape}`)).toEqual([
      'hong:0', 'hong:1', 'hong:2', 'vang:1', 'vang:2', 'vang:3', 'mint:2', 'mint:3', 'mint:4', 'tim:3', 'tim:4', 'tim:5'
    ]);
    for (const item of restored) {
      expect(item.matchesTemplate).toBe(true);
      expect(item.label).toMatch(/^Đồ vật màu /);
    }
  });

  test('bản lưu cũ chỉ có HTML khớp mẫu vẫn khôi phục được', async ({ page }) => {
    await openGame4(page);
    await seedState(page, 'return { color: color.id, html: KIEU_DO[index](color), done: false };');
    await openGame4(page);
    await expect(page.locator('#bhGameAutosaveStatus')).toContainText('Đã khôi phục');
    const shapes = await page.locator('#sanDo .do-vat').evaluateAll((items) => items.map((item) => Number(item.dataset.kieu)));
    expect(shapes).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2]);
  });

  test('HTML lạ trong bản lưu bị bỏ, không được chèn vào trang', async ({ page }) => {
    await openGame4(page);
    await seedState(page, `return {
      color: color.id,
      html: index === 0 ? '<img src="x" onerror="window.__injected = true">' : KIEU_DO[index](color),
      done: false
    };`);
    await openGame4(page);
    await expect(page.locator('#dongHo')).toHaveText('0:00');
    await expect(page.locator('#sanDo img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__injected === true)).toBe(false);
  });
});
