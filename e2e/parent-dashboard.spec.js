const { test, expect } = require('@playwright/test');

/*
 * Trang phụ huynh hiển thị đúng dữ liệu thật của bé: số liệu tổng, thống kê, từng trò (tên lấy từ catalog, số lượt,
 * đang chơi dở, phần thưởng của riêng trò đó), tên bé hiển thị nguyên văn (không chạy như HTML), và trạng thái trống.
 * Dữ liệu được tạo qua chính API của trang (BongProgress, BongRewards, BongProfile) rồi tải lại trang.
 * Thay cho các kiểm tra so chuỗi trên js/parent-dashboard.js, js/statistics.js, js/game-catalog.js.
 */

async function openParents(page) {
  await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.BongModulesReady && typeof window.BongModulesReady.then === 'function');
  await page.evaluate(() => window.BongModulesReady);
  await expect(page.locator('#completedCount')).toBeVisible();
}

const rows = (page) => page.locator('#gameSummary .bh-parent-game-row');
const row = (page, title) => rows(page).filter({ has: page.locator('.bh-parent-game-name', { hasText: title }) });

test.describe('Trang phụ huynh', () => {
  test('chưa có dữ liệu: số liệu bằng 0 và báo chưa có hoạt động', async ({ page }) => {
    await page.addInitScript(() => { if (!sessionStorage.getItem('bh-clean')) { sessionStorage.setItem('bh-clean', '1'); localStorage.clear(); } });
    await openParents(page);
    for (const id of ['completedCount', 'inProgressCount', 'starCount', 'collectionCount', 'recentCount']) {
      await expect(page.locator(`#${id}`), id).toHaveText('0');
    }
    await expect(page.locator('#averageDuration')).toHaveText('Chưa có');
    await expect(page.locator('#averageMoves')).toHaveText('Chưa có');
    await expect(rows(page)).toHaveCount(0);
    await expect(page.locator('#gameSummary')).toHaveText('Chưa có hoạt động nào được lưu trên thiết bị này.');
  });

  test('có dữ liệu: tổng, thống kê, từng trò và tên bé hiển thị đúng', async ({ page }) => {
    await page.addInitScript(() => { if (!sessionStorage.getItem('bh-clean')) { sessionStorage.setItem('bh-clean', '1'); localStorage.clear(); } });
    await openParents(page);
    await page.evaluate(() => {
      const progress = window.BongProgress;
      progress.completeGame('game2', { transactionId: 'e2e-g2-a', durationSeconds: 60, moves: 10 });
      progress.completeGame('game2', { transactionId: 'e2e-g2-b', durationSeconds: 90, moves: 10 });
      progress.completeGame('game3', { transactionId: 'e2e-g3-a', durationSeconds: 120, moves: 21 });
      progress.saveGame('game2', { status: 'in_progress', difficulty: '5-differences', state: { any: 1 } });
      progress.saveGame('game5', { status: 'in_progress', difficulty: 'connect-the-dots', state: { any: 1 } });
      window.BongRewards.awardStars('e2e-reward-g2', 2, { gameId: 'game2' });
      window.BongRewards.unlockSticker('little-flower', { source: 'game2-completion' });
      window.BongRewards.unlockBadge('first-finish', { source: 'game1-completion' });
      window.BongProfile.updateProfile({ displayName: '<b>An</b>' });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.BongModulesReady);

    await expect(page.locator('#completedCount')).toHaveText('3');
    await expect(page.locator('#inProgressCount')).toHaveText('2');
    await expect(page.locator('#starCount')).toHaveText('2');
    await expect(page.locator('#collectionCount')).toHaveText('2');
    await expect(page.locator('#recentCount')).toHaveText('3');
    await expect(page.locator('#averageDuration')).toHaveText('1 phút 30 giây');
    await expect(page.locator('#averageMoves')).toHaveText('14 lượt');
    await expect(page.locator('#latestActivity')).not.toHaveText('Chưa có');

    // Tên bé là chữ, không phải HTML.
    await expect(page.locator('#parentName')).toHaveText('<b>An</b>');
    await expect(page.locator('#parentName b')).toHaveCount(0);

    // Mỗi trò một dòng, xếp theo số trò; tên lấy từ catalog; phần thưởng chỉ của trò đó.
    await expect(rows(page).locator('.bh-parent-game-name')).toHaveText(['Lật Hình Tìm Cặp', 'Tìm Điểm Khác Biệt', 'Tìm Bóng Cho Hình', 'Nối Điểm Theo Số']);
    await expect(row(page, 'Tìm Điểm Khác Biệt').locator('.bh-parent-game-progress')).toHaveText('2 lượt hoàn thành · đang chơi dở');
    await expect(row(page, 'Tìm Điểm Khác Biệt').locator('.bh-parent-game-rewards')).toHaveText('⭐ 2 sao · 🌼 Bông hoa nhỏ');
    await expect(row(page, 'Tìm Bóng Cho Hình').locator('.bh-parent-game-progress')).toHaveText('1 lượt hoàn thành');
    await expect(row(page, 'Tìm Bóng Cho Hình').locator('.bh-parent-game-rewards')).toHaveText('🎁 Chưa ghi nhận phần thưởng');
    await expect(row(page, 'Nối Điểm Theo Số').locator('.bh-parent-game-progress')).toHaveText('Đang chơi dở');
    // Huy hiệu "Lần đầu hoàn thành" của Game 1 hiện ở dòng Game 1 dù chưa có lượt hoàn thành nào được ghi.
    await expect(row(page, 'Lật Hình Tìm Cặp').locator('.bh-parent-game-progress')).toHaveText('0 lượt hoàn thành');
    await expect(row(page, 'Lật Hình Tìm Cặp').locator('.bh-parent-game-rewards')).toHaveText('🎈 Lần đầu hoàn thành');
  });

  test('bảng số liệu chỉ đọc qua module dùng chung: không tự gọi localStorage hay fetch', async ({ page }) => {
    await page.addInitScript(() => {
      window.__directAccess = [];
      // Chỉ xét khung gọi trực tiếp (dòng 0: "Error", 1: record, 2: hàm bọc, 3: nơi gọi): bảng số liệu gọi module
      // dùng chung, rồi module đó mới đọc localStorage — như vậy là đúng.
      const record = (kind) => {
        const caller = (new Error().stack || '').split('\n')[3] || '';
        if (caller.includes('parent-dashboard.js')) window.__directAccess.push(kind);
      };
      for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args) { record(`localStorage.${method}`); return original.apply(this, args); };
      }
      const originalFetch = window.fetch;
      window.fetch = (...args) => { record('fetch'); return originalFetch(...args); };
    });
    await openParents(page);
    await expect(page.locator('#gameSummary')).not.toBeEmpty();
    expect(await page.evaluate(() => window.__directAccess)).toEqual([]);
  });

  test('trang chủ có lối vào trang phụ huynh và bộ sưu tập', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.BongModulesReady);
    await expect(page.locator('a[href="./parents.html"]')).toContainText('Dành cho phụ huynh');
    await expect(page.locator('a[href="./collection.html"]')).toContainText('Bộ sưu tập của');
  });
});
