const { test, expect } = require('@playwright/test');

for (const gameId of ['game2', 'game3', 'game4']) {
  test(`${gameId} có live region auto-save đầy đủ`, async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto(`/${gameId}.html`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('script[data-bh-games2-4-autosave]')).toBeAttached();
    await page.waitForFunction(() => Boolean(window.BongGamesAutosave));

    await page.evaluate(() => {
      document.querySelector('.man-thang')?.classList.add('hien');
    });

    const status = page.locator('#bhGameAutosaveStatus');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveAttribute('aria-atomic', 'true');
    await expect(status).toContainText('Đã lưu lượt hoàn thành');
  });
}
