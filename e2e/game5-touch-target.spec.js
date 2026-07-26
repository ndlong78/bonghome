const { test, expect } = require('@playwright/test');

const MIN_TARGET_PX = 44;

async function findExclusiveExpandedHitPoint(dot) {
  return dot.evaluate((element) => {
    const visibleCircle = element.querySelector('circle:not(.bh-game5-hit-target)');
    const hitCircle = element.querySelector('.bh-game5-hit-target');
    if (!(visibleCircle instanceof SVGCircleElement) || !(hitCircle instanceof SVGCircleElement)) return null;

    const matrix = visibleCircle.getScreenCTM();
    if (!matrix) return null;

    const center = new DOMPoint(
      Number(visibleCircle.getAttribute('cx') || 0),
      Number(visibleCircle.getAttribute('cy') || 0)
    ).matrixTransform(matrix);
    const scale = Math.hypot(matrix.a, matrix.b);
    const visibleRadius = Number(visibleCircle.getAttribute('r') || 0) * scale;
    const hitRadius = Number(hitCircle.getAttribute('r') || 0) * scale;

    for (let radius = visibleRadius + 4; radius <= hitRadius - 2; radius += 2) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
        const target = document.elementFromPoint(x, y);
        if (target?.closest('.diem') === element) return { x, y };
      }
    }

    return null;
  });
}

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

    const first = page.locator('#lopDiem .diem[data-i="0"]');
    const expandedPoint = await findExclusiveExpandedHitPoint(first);
    expect(expandedPoint, 'Cần tìm được điểm ngoài chấm nhìn thấy nhưng thuộc riêng vùng chạm mở rộng').not.toBeNull();

    await page.mouse.click(expandedPoint.x, expandedPoint.y);
    await expect(page.locator('#chamKeTiep')).toHaveText('2');
    await expect(first.locator('.bh-game5-hit-target')).toHaveAttribute('r', '27');
    await expect(first.locator('circle:not(.bh-game5-hit-target)')).toHaveAttribute('r', '13');
  });
});