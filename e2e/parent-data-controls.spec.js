const { test, expect } = require('@playwright/test');

const seededDocument = {
  schemaVersion: 1,
  updatedAt: '2026-07-27T00:00:00.000Z',
  data: {
    progress: {
      schemaVersion: 1,
      games: { game1: { status: 'in_progress' } },
      completions: { done: { transactionId: 'done', gameId: 'game1', completedAt: '2026-07-27T00:00:00.000Z' } }
    },
    rewards: { schemaVersion: 1, stars: 5, stickers: {}, badges: {}, transactions: {} },
    profile: { schemaVersion: 1, displayName: 'Bông thử nghiệm', avatarId: 'flower' },
    themes: { schemaVersion: 1, activeThemeId: 'animals' }
  }
};

async function waitForParentDashboardReady(page) {
  await page.waitForFunction(() => window.BongModulesReady && typeof window.BongModulesReady.then === 'function');
  await page.evaluate(() => window.BongModulesReady);
  await expect(page.locator('#completedCount')).toBeVisible();
  await expect(page.locator('[data-parent-delete="activity"]')).toBeVisible();
}

async function openSeededParentPage(page) {
  await page.addInitScript((document) => {
    localStorage.setItem('bonghome:data', JSON.stringify(document));
  }, seededDocument);
  await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
  await waitForParentDashboardReady(page);
  await expect(page.locator('#parentName')).toHaveText('Bông thử nghiệm');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'animals');
}

async function confirmAndWaitForReload(page) {
  await Promise.all([
    page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()),
    page.locator('#parentDataConfirm').click()
  ]);
  await page.waitForLoadState('domcontentloaded');
  await waitForParentDashboardReady(page);
}

test('hủy xác nhận không xóa dữ liệu', async ({ page }) => {
  await openSeededParentPage(page);
  await page.locator('[data-parent-delete="child"]').click();
  const dialog = page.locator('#parentDataDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#parentDataCancel')).toBeFocused();
  await page.locator('#parentDataCancel').click();
  await expect(dialog).not.toBeVisible();

  const document = await page.evaluate(() => JSON.parse(localStorage.getItem('bonghome:data')));
  expect(document.data.profile.displayName).toBe('Bông thử nghiệm');
  expect(document.data.rewards.stars).toBe(5);
  expect(document.data.themes.activeThemeId).toBe('animals');
});

test('xóa lịch sử chơi nhưng giữ hồ sơ và phần thưởng', async ({ page }) => {
  await openSeededParentPage(page);
  await page.locator('[data-parent-delete="activity"]').click();
  await expect(page.locator('#parentDataDialogDescription')).toContainText('Hồ sơ, sao, sticker và huy hiệu vẫn được giữ lại');
  await confirmAndWaitForReload(page);

  const document = await page.evaluate(() => JSON.parse(localStorage.getItem('bonghome:data')));
  expect(document.data.progress).toBeUndefined();
  expect(document.data.profile.displayName).toBe('Bông thử nghiệm');
  expect(document.data.rewards.stars).toBe(5);
  expect(document.data.themes.activeThemeId).toBe('animals');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'animals');
});

test('xóa toàn bộ dữ liệu của bé nhưng giữ lựa chọn chủ đề', async ({ page }) => {
  await openSeededParentPage(page);
  await page.locator('[data-parent-delete="child"]').click();
  await expect(page.locator('#parentDataDialogDescription')).toContainText('Thao tác này không thể hoàn tác');
  await confirmAndWaitForReload(page);

  const document = await page.evaluate(() => JSON.parse(localStorage.getItem('bonghome:data')));
  expect(document.data.progress).toBeUndefined();
  expect(document.data.rewards).toEqual(expect.objectContaining({ schemaVersion: 1, stars: 0 }));
  expect(document.data.profile).toEqual(expect.objectContaining({ schemaVersion: 1, displayName: 'Bông' }));
  expect(document.data.themes.activeThemeId).toBe('animals');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'animals');
  await expect(page.locator('#completedCount')).toHaveText('0');
  await expect(page.locator('#starCount')).toHaveText('0');
});
