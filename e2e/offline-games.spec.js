const { test, expect } = require('@playwright/test');

function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test.describe('10 trò chơi hoạt động ngoại tuyến', () => {
  test('mở và reload được toàn bộ game sau khi app shell đã được cache', async ({ page, context }) => {
    const errors = collectRuntimeErrors(page);

    await page.goto('/index.html', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) throw new Error('Trình duyệt không hỗ trợ Service Worker');
      await navigator.serviceWorker.ready;
    });
    await page.reload({ waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await context.setOffline(true);
    try {
      for (let game = 1; game <= 10; game += 1) {
        const path = `/game${game}.html`;
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('body'), `${path} phải hiển thị khi offline`).toBeVisible();
        await expect(page.locator('h1').first(), `${path} phải có tiêu đề`).not.toHaveText('');

        await page.waitForFunction(() => window.BongModulesReady && typeof window.BongModulesReady.then === 'function');
        await page.evaluate(() => window.BongModulesReady);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('body'), `${path} phải reload được khi offline`).toBeVisible();
      }
    } finally {
      await context.setOffline(false);
    }

    expect(errors, 'Không được có lỗi runtime trong luồng 10 game offline').toEqual([]);
  });
});
