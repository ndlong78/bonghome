const { test, expect } = require('@playwright/test');

/*
 * Việc shared-ui.js làm khi trang khởi động, chạy thật trên trang: chuyển đổi hồ sơ và chủ đề đã lưu sang định dạng
 * hiện tại, áp chủ đề (Game 1 dùng nội dung của chủ đề đang chọn), báo thay đổi âm thanh cho các lớp khác và dừng
 * giọng đọc khi tắt âm. Thay cho các kiểm tra so chuỗi trên shared-ui.js.
 */

/** Ghi tài liệu bonghome:data trước khi trang chạy (chỉ lần mở đầu tiên). */
async function seed(page, data) {
  await page.addInitScript((value) => {
    if (sessionStorage.getItem('bh-seeded')) return;
    sessionStorage.setItem('bh-seeded', '1');
    localStorage.clear();
    localStorage.setItem('bonghome:data', JSON.stringify({ schemaVersion: 1, data: value }));
  }, data);
}

const stored = (page, key) => page.evaluate((name) => JSON.parse(localStorage.getItem('bonghome:data') || '{}').data?.[name], key);

test.describe('Khởi động dùng chung (shared-ui.js)', () => {
  test('hồ sơ đã lưu được chuẩn hoá và ghi lại khi mở trang', async ({ page }) => {
    await seed(page, { profile: { displayName: '  Mai \u0007  An  ', avatarId: 'Không hợp lệ' } });
    await page.goto('/index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.BongModulesReady);
    await page.evaluate(() => window.BongModulesReady);
    await expect.poll(() => stored(page, 'profile')).toEqual({ schemaVersion: 1, displayName: 'Mai An', avatarId: 'flower' });
  });

  test('chủ đề lưu theo định dạng cũ được chuyển đổi, áp lên trang và Game 1 dùng nội dung của chủ đề đó', async ({ page }) => {
    await seed(page, { themes: 'animals' });
    await page.goto('/game1.html', { waitUntil: 'load' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'animals');
    await expect.poll(() => stored(page, 'themes')).toEqual({ schemaVersion: 1, activeThemeId: 'animals' });
    await expect(page.locator('.thanh-tren h1')).toHaveText('Lật Hình Động Vật');
    await expect.poll(() => page.evaluate(() => window.BongGame1Content?.themeId)).toBe('animals');
  });

  test('tắt âm báo cho các lớp khác và dừng giọng đọc đang phát; bật lại thì không dừng', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('bonghome_sound_enabled');
      window.__sound = { events: [], cancels: 0 };
      addEventListener('bonghome:soundchange', (event) => window.__sound.events.push(event.detail.enabled));
      if ('speechSynthesis' in window) {
        const original = speechSynthesis.cancel.bind(speechSynthesis);
        speechSynthesis.cancel = () => { window.__sound.cancels += 1; original(); };
      }
    });
    await page.goto('/game9.html', { waitUntil: 'load' });
    const button = page.locator('#nutAmThanh');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    // shared-ui.js cũng báo trạng thái một lần lúc khởi động: chỉ xét từ lúc bé bấm nút.
    await page.evaluate(() => { window.__sound = { events: [], cancels: 0 }; });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.__sound)).toEqual({ events: [false, true], cancels: 1 });
  });
});
