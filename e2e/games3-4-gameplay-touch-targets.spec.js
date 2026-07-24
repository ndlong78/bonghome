const { test, expect } = require('@playwright/test');

const MIN_TARGET_PX = 44;

async function expectTargetsAtLeast(page, selector, label) {
  const targets = page.locator(selector);
  const count = await targets.count();
  expect(count, `${label} cần có ít nhất một mục tiêu đang render`).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    await expect(target, `${label} ${index + 1} cần hiển thị`).toBeVisible();
    const box = await target.boundingBox();
    expect(box, `${label} ${index + 1} cần có kích thước render`).not.toBeNull();
    expect(box.width, `${label} ${index + 1} rộng ${box.width.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    expect(box.height, `${label} ${index + 1} cao ${box.height.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  }
}

test.describe('Vùng chạm gameplay Game 3–4', () => {
  test('Game 3 giữ hình màu và ô bóng tối thiểu 44×44px', async ({ page }) => {
    await page.goto('/game3.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('.mieng-hinh').length === 6 && document.querySelectorAll('.o-bong').length === 6);

    await expectTargetsAtLeast(page, '.mieng-hinh:not(.xong)', 'Hình màu Game 3');
    await expectTargetsAtLeast(page, '.o-bong', 'Ô bóng Game 3');
  });

  test('Game 4 giữ đồ vật và giỏ tối thiểu 44×44px', async ({ page }) => {
    await page.goto('/game4.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('.do-vat').length === 12 && document.querySelectorAll('.gio').length === 4);

    await expectTargetsAtLeast(page, '.do-vat:not(.xong)', 'Đồ vật Game 4');
    await expectTargetsAtLeast(page, '.gio', 'Giỏ Game 4');
  });
});
