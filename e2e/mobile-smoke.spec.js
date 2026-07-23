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

test.describe('Bông Home trên màn hình iPhone và iPad', () => {
  for (const entry of pages) {
    test(`${entry.path} mở được, có shared modules và không lỗi runtime`, async ({ page }) => {
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

  test('app shell và Góc phụ huynh reload được khi offline', async ({ page, context }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto('/index.html', { waitUntil: 'networkidle' });

    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) throw new Error('Trình duyệt không hỗ trợ Service Worker');
      await navigator.serviceWorker.ready;
    });
    await page.reload({ waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await page.goto('/parents.html', { waitUntil: 'networkidle' });
    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Góc phụ huynh' })).toBeVisible();
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }

    expect(errors, 'Không được có lỗi runtime trong luồng offline').toEqual([]);
  });
});
