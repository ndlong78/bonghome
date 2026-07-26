const { test, expect } = require('@playwright/test');

for (const gameId of ['game8', 'game9', 'game10']) {
  test(`${gameId} có live region phần thưởng đầy đủ và không cướp focus`, async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto(`/${gameId}.html`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('script[data-bh-games8-10-rewards]')).toBeAttached();
    await page.waitForFunction(() => typeof window.BongProgress?.completeGame === 'function');

    const soundButton = page.locator('#nutAmThanh');
    await expect(soundButton).toBeVisible();
    await soundButton.focus();
    await expect(soundButton).toBeFocused();

    await page.evaluate((id) => {
      window.BongProgress.completeGame(id, {
        transactionId: `e2e-live-region-${id}-${Date.now()}`
      });
    }, gameId);

    const summary = page.locator('.man-thang .bh-reward-summary');
    await expect(summary).toHaveAttribute('role', 'status');
    await expect(summary).toHaveAttribute('aria-live', 'polite');
    await expect(summary).toHaveAttribute('aria-atomic', 'true');
    await expect(summary).toContainText('Bé nhận');
    await expect(soundButton).toBeFocused();
  });
}
