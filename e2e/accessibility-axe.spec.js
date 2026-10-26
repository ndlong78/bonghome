const { test, expect } = require('@playwright/test');

/*
 * Quét axe-core trên từng trang thật (và hộp thoại thắng của game 1–10): landmark, vai trò ARIA, tên truy cập khớp chữ
 * nhìn thấy, danh sách định nghĩa, điều khiển lồng nhau… Tắt riêng color-contrast: các màu chữ nhạt hiện tại chưa đạt
 * 4.5:1 và sẽ được sửa ở thay đổi riêng (đổi màu là đổi giao diện); độ tương phản của chữ hướng dẫn, thông báo lưu và
 * hộp thoại thắng đã có kiểm tra riêng trong e2e/*-contrast.spec.js.
 */

const AXE_SOURCE = require.resolve('axe-core/axe.min.js');
const PAGES = ['/index.html', '/parents.html', '/collection.html', ...Array.from({ length: 13 }, (_, index) => `/game${index + 1}.html`)];
const WITH_WIN_DIALOG = /\/game([1-9]|10)\.html$/;

/** Vi phạm axe gọn để đọc trong log: luật, mức độ và bộ chọn của từng phần tử. */
const runAxe = (page) => page.evaluate(async () => {
  const { violations } = await window.axe.run(document, {
    resultTypes: ['violations'],
    rules: { 'color-contrast': { enabled: false } }
  });
  return violations.map((violation) => `${violation.id} [${violation.impact}]: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
});

test.describe('Quét trợ năng axe-core', () => {
  test.beforeEach(async ({ page }) => {
    // Init script không bị CSP script-src 'self' chặn (khác với chèn thẻ <script> nội tuyến).
    await page.addInitScript({ path: AXE_SOURCE });
  });

  for (const path of PAGES) {
    test(`${path} không có vi phạm axe (trừ tương phản màu)`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });
      await page.waitForFunction(() => window.BongModulesReady && typeof window.BongModulesReady.then === 'function');
      await page.evaluate(() => window.BongModulesReady);
      expect(await runAxe(page), path).toEqual([]);

      if (!WITH_WIN_DIALOG.test(path)) return;
      await page.evaluate(() => document.querySelector('.man-thang').classList.add('hien'));
      await expect(page.locator('.man-thang')).toBeVisible();
      expect(await runAxe(page), `${path} hộp thoại thắng`).toEqual([]);
    });
  }
});
