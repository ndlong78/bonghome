const { test, expect } = require('@playwright/test');

test('phần thưởng Game 1 có live region đầy đủ và không cướp focus', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/game1.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('script[data-bh-game1-rewards]');
  await page.waitForFunction(() => typeof window.BongProgress?.completeGame === 'function');

  const soundButton = page.locator('#nutAmThanh');
  await expect(soundButton).toBeVisible();
  await soundButton.focus();
  await expect(soundButton).toBeFocused();

  await page.evaluate(() => {
    window.BongProgress.completeGame('game1', {
      transactionId: `e2e-live-region-${Date.now()}`,
      difficulty: 3,
      theme: 'bong-home'
    });
  });

  const summary = page.locator('#manThang .bh-game1-reward-summary');
  await expect(summary).toHaveAttribute('role', 'status');
  await expect(summary).toHaveAttribute('aria-live', 'polite');
  await expect(summary).toHaveAttribute('aria-atomic', 'true');
  await expect(summary).toContainText('Bé nhận');
  await expect(soundButton).toBeFocused();
});