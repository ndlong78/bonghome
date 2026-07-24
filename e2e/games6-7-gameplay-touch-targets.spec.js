const { test, expect } = require('@playwright/test');

const MIN_TARGET_PX = 44;

async function expectVisibleTargetsAtLeast(page, selector, label) {
  const targets = page.locator(selector);
  const count = await targets.count();
  expect(count, `${label} cần có mục tiêu tương tác`).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    await expect(target, `${label} ${index + 1} cần hiển thị`).toBeVisible();
    const box = await target.boundingBox();
    expect(box, `${label} ${index + 1} cần có kích thước render`).not.toBeNull();
    expect(box.width, `${label} ${index + 1} rộng ${box.width.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    expect(box.height, `${label} ${index + 1} cao ${box.height.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  }
}

test.describe('Vùng chạm gameplay Game 6–7', () => {
  test('Game 6 giữ các ô hình tối thiểu 44px', async ({ page }) => {
    await page.goto('/game6.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#luoi .o-hinh').length > 0);
    await expectVisibleTargetsAtLeast(page, '#luoi .o-hinh', 'Ô hình Game 6');
  });

  test('Game 7 giữ bốn lựa chọn tối thiểu 44px', async ({ page }) => {
    await page.goto('/game7.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#luaChon .nut-chon').length > 0);
    await expect(page.locator('#luaChon .nut-chon')).toHaveCount(4);
    await expectVisibleTargetsAtLeast(page, '#luaChon .nut-chon', 'Lựa chọn Game 7');
  });
});
