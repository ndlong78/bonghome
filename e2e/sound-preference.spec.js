const { test, expect } = require('@playwright/test');

const gamePages = Array.from({ length: 10 }, (_, index) => `/game${index + 1}.html`);

async function waitForSoundButton(page) {
  const button = page.locator('#nutAmThanh');
  await expect(button).toBeVisible();
  return button;
}

test.describe('Thiết lập âm thanh dùng chung', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('bonghome_sound_enabled'));
  });

  test('nút âm thanh có trạng thái truy cập đúng và giữ lựa chọn qua reload, điều hướng', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    let button = await waitForSoundButton(page);

    await expect(button).toHaveText('🔊 Âm thanh');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button).toHaveAttribute('aria-label', 'Tắt âm thanh');
    await expect(page.locator('html')).toHaveAttribute('data-sound', 'on');

    await button.click();
    await expect(button).toHaveText('🔇 Im lặng');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button).toHaveAttribute('aria-label', 'Bật âm thanh');
    await expect(page.locator('html')).toHaveAttribute('data-sound', 'off');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('bonghome_sound_enabled'))).toBe('false');

    await page.reload({ waitUntil: 'domcontentloaded' });
    button = await waitForSoundButton(page);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-sound', 'off');

    for (const path of gamePages) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      button = await waitForSoundButton(page);
      await expect(button, `${path} phải giữ trạng thái im lặng`).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('html')).toHaveAttribute('data-sound', 'off');
    }

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('bonghome_sound_enabled'))).toBe('true');
  });
});
