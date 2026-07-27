const { test, expect } = require('@playwright/test');

const pages = [
  '/index.html',
  '/parents.html',
  ...Array.from({ length: 10 }, (_, index) => `/game${index + 1}.html`)
];

async function expectNoHorizontalOverflow(page, path) {
  await expect.poll(
    () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body?.scrollWidth || 0
    })),
    { message: `${path} không được tràn ngang viewport` }
  ).toEqual(expect.objectContaining({
    viewport: expect.any(Number)
  }));

  const overflow = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body?.scrollWidth || 0;
    return {
      viewport,
      documentWidth,
      bodyWidth,
      overflow: Math.max(documentWidth, bodyWidth) - viewport
    };
  });

  expect(overflow.overflow, `${path} tràn ngang ${overflow.overflow}px`).toBeLessThanOrEqual(1);
}

test.describe('Responsive không tràn ngang', () => {
  test('12 trang vừa viewport sau tải và reload', async ({ page }) => {
    for (const path of pages) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body'), `${path} phải hiển thị`).toBeVisible();
      await page.evaluate(async () => {
        if (window.BongModulesReady) await window.BongModulesReady;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await expectNoHorizontalOverflow(page, path);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('body'), `${path} phải hiển thị sau reload`).toBeVisible();
      await page.evaluate(async () => {
        if (window.BongModulesReady) await window.BongModulesReady;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await expectNoHorizontalOverflow(page, `${path} sau reload`);
    }
  });
});
