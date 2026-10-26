const { test, expect } = require('@playwright/test');

/*
 * Nút hồ sơ, danh sách avatar và bộ chọn chủ đề chạy thật trên trang: tên do bé nhập luôn hiển thị nguyên văn
 * (không chạy như HTML), avatar là nhóm nút radio, bộ chọn chủ đề chỉ có ở trang chủ và Game 1, đổi chủ đề ở Game 1
 * thì lưu ván rồi tải lại để dùng bộ hình mới. Thay cho các kiểm tra so chuỗi trên js/profile-ui.js, js/theme-picker.js.
 */

const NAME = '<img src=x onerror="window.__xss=1">Mai';

async function ready(page) {
  await page.waitForFunction(() => window.BongModulesReady && typeof window.BongModulesReady.then === 'function');
  await page.evaluate(() => window.BongModulesReady);
}

test.describe('Hồ sơ và chủ đề', () => {
  test('tên bé có ký tự HTML hiển thị nguyên văn trên nút hồ sơ', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await ready(page);
    await page.evaluate((name) => window.BongProfile.updateProfile({ displayName: name }), NAME);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    const button = page.locator('#bhProfileButton');
    await expect(button).toContainText(NAME.slice(0, 20));
    await expect(button).toHaveAttribute('aria-label', `Mở hồ sơ của ${NAME.slice(0, 20)}`);
    await expect(button.locator('img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test('avatar là nhóm nút radio có tên chữ, chọn avatar rồi lưu thì hồ sơ đổi theo', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await ready(page);
    await page.locator('#bhProfileButton').click();
    const dialog = page.locator('.bh-profile-dialog');
    const radios = dialog.locator('input[type="radio"][name="avatarId"]');
    expect(await radios.count()).toBeGreaterThan(1);
    const labels = await dialog.locator('label:has(input[name="avatarId"])').allTextContents();
    expect(labels.every((text) => text.trim().length > 0)).toBe(true);
    const target = await radios.nth(1).getAttribute('value');
    await radios.nth(1).check();
    await dialog.locator('button[type="submit"]').click();
    await expect.poll(() => page.evaluate(() => window.BongProfile.getProfile().avatarId)).toBe(target);
  });

  test('bộ chọn chủ đề chỉ có ở trang chủ và Game 1; ở trang chủ đổi chủ đề ngay không tải lại', async ({ page }) => {
    for (const path of ['/game2.html', '/parents.html']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await ready(page);
      await expect(page.locator('.bh-theme-picker'), path).toHaveCount(0);
    }
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await ready(page);
    const picker = page.locator('.bh-theme-picker');
    await expect(picker).toHaveCount(1);
    const animals = picker.locator('button[data-theme-id="animals"]');
    await expect(animals).toHaveAttribute('aria-label', /^Chọn chủ đề /);
    await expect(animals.locator('span').nth(1)).not.toBeEmpty();
    await page.evaluate(() => { window.__notReloaded = true; });
    await animals.click();
    await expect(animals).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'animals');
    expect(await page.evaluate(() => window.__notReloaded)).toBe(true);
  });

  test('đổi chủ đề ở Game 1: lưu ván đang chơi rồi tải lại với bộ hình của chủ đề mới', async ({ page }) => {
    await page.addInitScript(() => { if (!sessionStorage.getItem('bh-clean')) { sessionStorage.setItem('bh-clean', '1'); localStorage.clear(); } });
    await page.goto('/game1.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.BongGame1 && window.BongGame1Autosave && window.BongGame1Content);
    await page.evaluate(() => {
      // bonghome:pause là tín hiệu để autosave lưu ván ngay (bộ chọn chủ đề phát nó, pwa-quality.js cũng phát khi
      // rời trang); ghi vào sessionStorage để còn thấy sau khi tải lại.
      addEventListener('bonghome:pause', () => sessionStorage.setItem('bh-paused-before-reload', String(Date.now())));
      window.__notReloaded = true;
    });
    const animals = page.locator('.bh-theme-picker button[data-theme-id="animals"]');
    await Promise.all([
      page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()),
      animals.click()
    ]);
    await page.waitForFunction(() => window.BongGame1Content?.themeId === 'animals');
    expect(await page.evaluate(() => window.__notReloaded)).toBeUndefined();
    expect(await page.evaluate(() => sessionStorage.getItem('bh-paused-before-reload'))).not.toBeNull();
    await expect(page.locator('.thanh-tren h1')).toHaveText('Lật Hình Động Vật');
  });
});
