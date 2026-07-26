const { test, expect } = require('@playwright/test');

const STORAGE_KEY = 'bonghome_sound_enabled';
const gamePages = Array.from({ length: 10 }, (_, index) => `/game${index + 1}.html`);

async function waitForSoundButton(page) {
  const button = page.locator('#nutAmThanh');
  await expect(button).toBeVisible();
  return button;
}

async function expectSoundState(page, enabled, message = '') {
  const button = await waitForSoundButton(page);
  const prefix = message ? `${message}: ` : '';

  await expect(button, `${prefix}nút phải hiển thị đúng trạng thái`).toHaveText(enabled ? '🔊 Âm thanh' : '🔇 Im lặng');
  await expect(button, `${prefix}aria-pressed phải đúng`).toHaveAttribute('aria-pressed', enabled ? 'true' : 'false');
  await expect(button, `${prefix}aria-label phải đúng`).toHaveAttribute('aria-label', enabled ? 'Tắt âm thanh' : 'Bật âm thanh');
  await expect(page.locator('html'), `${prefix}data-sound phải đúng`).toHaveAttribute('data-sound', enabled ? 'on' : 'off');
  await expect.poll(
    () => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
    { message: `${prefix}localStorage phải giữ trạng thái` }
  ).toBe(enabled ? 'true' : 'false');

  return button;
}

test.describe('Thiết lập âm thanh dùng chung', () => {
  test('nút âm thanh có trạng thái truy cập đúng và giữ lựa chọn qua reload, điều hướng', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload({ waitUntil: 'domcontentloaded' });

    let button = await waitForSoundButton(page);
    await expect(button).toHaveText('🔊 Âm thanh');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button).toHaveAttribute('aria-label', 'Tắt âm thanh');
    await expect(page.locator('html')).toHaveAttribute('data-sound', 'on');

    try {
      await button.click();
      button = await expectSoundState(page, false, 'Sau khi tắt âm');

      await page.reload({ waitUntil: 'domcontentloaded' });
      button = await expectSoundState(page, false, 'Sau reload');

      for (const path of gamePages) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        button = await expectSoundState(page, false, path);
      }
    } finally {
      await page.evaluate((key) => localStorage.setItem(key, 'true'), STORAGE_KEY).catch(() => {});
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectSoundState(page, true, 'Sau khi khôi phục');
  });
});
