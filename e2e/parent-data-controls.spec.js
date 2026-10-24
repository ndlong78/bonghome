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
    const marker = 'bonghome-parent-data-seeded';
    if (sessionStorage.getItem(marker) === 'true') return;
    localStorage.setItem('bonghome:data', JSON.stringify(document));
    sessionStorage.setItem(marker, 'true');
  }, seededDocument);
  await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
  await waitForParentDashboardReady(page);
  await expect(page.locator('#parentName')).toHaveText('Bông thử nghiệm');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'animals');
}

/** Trả lời cổng phụ huynh bằng chính câu hỏi đang hiện trong hộp thoại. */
async function answerParentGate(page) {
  const question = await page.locator('#parentGateQuestion').textContent();
  const [left, right] = question.split('×').map((part) => Number(part.trim()));
  await page.locator('#parentGateAnswer').fill(String(left * right));
  await expect(page.locator('#parentDataConfirm')).toBeEnabled();
}

async function confirmAndWaitForReload(page) {
  await answerParentGate(page);
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
  await expect(page.locator('#completedCount')).toHaveText('0');
  await expect(page.locator('#inProgressCount')).toHaveText('0');
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
  await expect(page.locator('#parentName')).toHaveText('Bông');
  await expect(page.locator('#completedCount')).toHaveText('0');
  await expect(page.locator('#starCount')).toHaveText('0');
});

test('cổng phụ huynh: nút xóa khóa đến khi trả lời đúng phép nhân', async ({ page }) => {
  await openSeededParentPage(page);
  await page.locator('[data-parent-delete="child"]').click();
  const confirm = page.locator('#parentDataConfirm');
  await expect(page.locator('#parentGateQuestion')).toHaveText(/^[6-9] × [6-9]$/);
  await expect(confirm).toBeDisabled();

  const question = await page.locator('#parentGateQuestion').textContent();
  const [left, right] = question.split('×').map((part) => Number(part.trim()));
  await page.locator('#parentGateAnswer').fill(String(left * right + 1));
  await expect(confirm).toBeDisabled();
  await expect(page.locator('#parentGateAnswer')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#parentGateAnswer').press('Enter');
  await confirm.click({ force: true }).catch(() => {});
  await expect(page.locator('#parentDataDialog')).toBeVisible();

  let document = await page.evaluate(() => JSON.parse(localStorage.getItem('bonghome:data')));
  expect(document.data.rewards.stars).toBe(5);

  // Hủy rồi mở lại: câu trả lời cũ bị xóa, nút lại khóa.
  await page.locator('#parentDataCancel').click();
  await page.locator('[data-parent-delete="child"]').click();
  await expect(page.locator('#parentGateAnswer')).toHaveValue('');
  await expect(confirm).toBeDisabled();

  // Trả lời đúng rồi nhấn Enter cũng xác nhận được.
  const nextQuestion = await page.locator('#parentGateQuestion').textContent();
  const [a, b] = nextQuestion.split('×').map((part) => Number(part.trim()));
  await page.locator('#parentGateAnswer').fill(String(a * b));
  await Promise.all([
    page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()),
    page.locator('#parentGateAnswer').press('Enter')
  ]);
  await page.waitForLoadState('domcontentloaded');
  await waitForParentDashboardReady(page);
  document = await page.evaluate(() => JSON.parse(localStorage.getItem('bonghome:data')));
  expect(document.data.rewards).toEqual(expect.objectContaining({ schemaVersion: 1, stars: 0 }));
  expect(document.data.profile.displayName).toBe('Bông');
});
