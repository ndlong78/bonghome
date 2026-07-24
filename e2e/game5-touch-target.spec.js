const { test, expect } = require('@playwright/test');

const MIN_TARGET_PX = 44;

test.describe('Vùng chạm Game 5', () => {
  test('mọi chấm đạt ít nhất 44px và phần mở rộng vẫn kích hoạt gameplay', async ({ page }) => {
    await page.goto('/game5.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (
      window.BongGame5TouchTarget?.hitRadius === 27
      && document.querySelectorAll('#lopDiem .diem').length > 0
      && document.querySelectorAll('#lopDiem .bh-game5-hit-target').length === document.querySelectorAll('#lopDiem .diem').length
    ));

    const dots = page.locator('#lopDiem .diem');
    const count = await dots.count();
    expect(count, 'Game 5 cần dựng các chấm nối').toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const box = await dots.nth(index).boundingBox();
      expect(box, `Chấm ${index + 1} cần hiển thị`).not.toBeNull();
      expect(box.width, `Chấm ${index + 1} rộng ${box.width.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(box.height, `Chấm ${index + 1} cao ${box.height.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    }

    const firstDot = dots.filter({ has: page.locator('[data-i="0"]') });
    const first = page.locator('#lopDiem .diem[data-i="0"]');
    const firstBox = await first.boundingBox();
    expect(firstBox).not.toBeNull();
    await page.mouse.click(firstBox.x + 3, firstBox.y + firstBox.height / 2);
    await expect(page.locator('#chamKeTiep')).toHaveText('2');
    await expect(first.locator('.bh-game5-hit-target')).toHaveAttribute('r', '27');
    await expect(first.locator('circle:not(.bh-game5-hit-target)')).toHaveAttribute('r', '13');
  });
});
