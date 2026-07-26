const { test, expect } = require('@playwright/test');

const pages = [
  { path: '/index.html', heading: /Bông Home/i },
  { path: '/parents.html', heading: /Góc phụ huynh/i },
  ...Array.from({ length: 10 }, (_, index) => ({
    path: `/game${index + 1}.html`,
    heading: /.+/
  }))
];

function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test.describe('Bông Home trên desktop Chromium', () => {
  for (const entry of pages) {
    test(`${entry.path} mở và reload được mà không có lỗi runtime`, async ({ page }) => {
      const errors = collectRuntimeErrors(page);

      const response = await page.goto(entry.path, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${entry.path} phải trả HTTP thành công`).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('h1').first()).toHaveText(entry.heading);

      await page.waitForFunction(() => window.BongModulesReady && typeof window.BongModulesReady.then === 'function');
      await page.evaluate(() => window.BongModulesReady);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();

      expect(errors, `Không được có lỗi runtime tại ${entry.path}`).toEqual([]);
    });
  }
});
