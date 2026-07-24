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

test.describe('Vùng chạm gameplay Game 8–10', () => {
  test('Game 8 giữ bốn phím hướng tối thiểu 44px', async ({ page }) => {
    await page.goto('/game8.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.phim-huong button')).toHaveCount(4);
    await expectVisibleTargetsAtLeast(page, '.phim-huong button', 'Phím hướng Game 8');
  });

  test('Game 9 giữ nút bắt từ khóa tối thiểu 44px', async ({ page }) => {
    await page.goto('/game9.html', { waitUntil: 'domcontentloaded' });
    await expectVisibleTargetsAtLeast(page, '#nutBat', 'Nút bắt từ khóa Game 9');
  });

  test('Game 10 giữ nút gõ nhịp tối thiểu 44px', async ({ page }) => {
    await page.goto('/game10.html', { waitUntil: 'domcontentloaded' });
    await expectVisibleTargetsAtLeast(page, '#nutGo', 'Nút gõ nhịp Game 10');
  });
});
