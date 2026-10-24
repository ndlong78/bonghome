const { test, expect } = require('@playwright/test');

async function waitForParentDashboard(page) {
  await expect(page.locator('#parentTitle')).toHaveText('Góc phụ huynh');
  await page.waitForFunction(() => window.BongModulesReady && typeof window.BongModulesReady.then === 'function');
  await page.evaluate(() => window.BongModulesReady);
  await expect(page.locator('#completedCount')).toBeVisible();
  await expect(page.locator('#starCount')).toBeVisible();
}

function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

test.describe('Storage recovery và migration', () => {
  test('JSON hỏng được phục hồi và Góc phụ huynh vẫn hoạt động', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('bonghome:data', '{broken-json');
    });

    await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
    await waitForParentDashboard(page);

    const recovered = await page.evaluate(() => ({
      raw: localStorage.getItem('bonghome:data'),
      backups: Object.keys(localStorage)
        .filter((key) => key.startsWith('bonghome:data:corrupt:'))
        .map((key) => localStorage.getItem(key)),
      mode: window.BongStorage?.getRecoveryMode(),
      persistent: window.BongStorage?.isPersistent()
    }));

    const document = JSON.parse(recovered.raw);
    expect(document.schemaVersion).toBe(1);
    expect(document.data).toEqual(expect.objectContaining({
      rewards: expect.any(Object),
      profile: expect.any(Object)
    }));
    expect(recovered.mode).toBe('corrupt-json');
    expect(recovered.persistent).toBe(true);
    expect(recovered.backups).toEqual(['{broken-json']);
    await expect(page.locator('#storageHealth')).toBeVisible();
    await expect(page.locator('#storageHealth')).toContainText('bản sao lưu');
    expect(errors).toEqual([]);
  });

  test('schema tương lai được giữ nguyên và ứng dụng chuyển sang bộ nhớ tạm', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    const futureDocument = {
      schemaVersion: 999,
      updatedAt: '2099-01-01T00:00:00.000Z',
      data: { futureOnly: { keep: true } }
    };

    await page.addInitScript((document) => {
      localStorage.setItem('bonghome:data', JSON.stringify(document));
    }, futureDocument);

    await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
    await waitForParentDashboard(page);

    const result = await page.evaluate(() => ({
      raw: localStorage.getItem('bonghome:data'),
      mode: window.BongStorage?.getRecoveryMode(),
      persistent: window.BongStorage?.isPersistent(),
      profile: window.BongProfile?.getProfile(),
      rewards: window.BongRewards?.getSummary(),
      progress: window.BongProgress?.getSummary()
    }));

    expect(JSON.parse(result.raw)).toEqual(futureDocument);
    expect(result.mode).toBe('future-schema');
    expect(result.persistent).toBe(false);
    expect(result.profile).toEqual(expect.objectContaining({ schemaVersion: 1, displayName: 'Bông' }));
    expect(result.rewards).toEqual(expect.objectContaining({ schemaVersion: 1, stars: 0 }));
    expect(result.progress).toEqual(expect.objectContaining({ schemaVersion: 1, completed: 0 }));
    await expect(page.locator('#storageHealth')).toContainText('phiên bản mới hơn');
    expect(errors).toEqual([]);
  });

  test('thiết bị từ chối ghi thì Góc phụ huynh cảnh báo và dữ liệu vẫn dùng được trong phiên', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('bonghome:data', JSON.stringify({ schemaVersion: 1, data: { rewards: { schemaVersion: 1, stars: 7 } } }));
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (key === 'bonghome:data') throw new DOMException('full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });

    await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
    await waitForParentDashboard(page);

    const health = await page.evaluate(() => window.BongStorage?.getHealth());
    expect(health).toEqual(expect.objectContaining({ recoveryMode: 'write-failed', pendingWrite: true, persistent: false }));
    await expect(page.locator('#starCount')).toHaveText('7');
    await expect(page.locator('#storageHealth')).toContainText('từ chối lưu');
    expect(errors).toEqual([]);
  });

  test('bộ nhớ bình thường thì không hiện cảnh báo', async ({ page }) => {
    await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
    await waitForParentDashboard(page);
    await expect(page.locator('#storageHealth')).toBeHidden();
  });
});
