const { test, expect } = require('@playwright/test');

async function waitForProfileUI(page) {
  await page.waitForFunction(() => window.BongModulesReady && typeof window.BongModulesReady.then === 'function');
  await page.evaluate(() => window.BongModulesReady);
  await expect(page.locator('#bhProfileButton')).toBeVisible();
}

test.describe('Hộp Hồ sơ của bé', () => {
  test('giữ focus bên trong, khóa nền và khôi phục focus khi đóng', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await waitForProfileUI(page);

    const trigger = page.locator('#bhProfileButton');
    const dialog = page.locator('.bh-profile-dialog');
    const nameInput = dialog.locator('input[name="displayName"]');
    const saveButton = dialog.locator('button[type="submit"]');

    await trigger.focus();
    await trigger.click();

    await expect(dialog).toBeVisible();
    await expect(nameInput).toBeFocused();
    await expect.poll(() => page.evaluate(() => (
      [...document.body.children]
        .filter((item) => !item.classList.contains('bh-profile-dialog'))
        .every((item) => item.inert)
    ))).toBe(true);

    await page.keyboard.press('Shift+Tab');
    await expect(saveButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(nameInput).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect.poll(() => page.evaluate(() => (
      [...document.body.children].every((item) => !item.inert)
    ))).toBe(true);
  });
});
