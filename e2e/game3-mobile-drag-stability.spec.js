const { test, expect } = require('@playwright/test');

async function dragToMatchingShadow(page, piece, expectedProgress) {
  const shapeId = await piece.getAttribute('data-id');
  const target = page.locator(`.o-bong[data-id="${shapeId}"]`);
  await expect(piece).toBeVisible();
  await expect(target).toBeVisible();

  const from = await piece.boundingBox();
  const to = await target.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#soDung')).toHaveText(expectedProgress);
}

test('Game 3 không làm vùng bóng nhảy lên khi kéo hình thứ ba', async ({ page }) => {
  await page.goto('/game3.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    document.querySelectorAll('.mieng-hinh').length === 6
    && document.querySelectorAll('.o-bong').length === 6
    && window.BongGame3DragStability?.isReady?.()
  ));

  await dragToMatchingShadow(page, page.locator('.mieng-hinh:not(.xong)').first(), '1/6');
  await dragToMatchingShadow(page, page.locator('.mieng-hinh:not(.xong)').first(), '2/6');
  await page.waitForTimeout(550);

  const thirdPiece = page.locator('.mieng-hinh:not(.xong)').first();
  const shapeId = await thirdPiece.getAttribute('data-id');
  const target = page.locator(`.o-bong[data-id="${shapeId}"]`);
  const from = await thirdPiece.boundingBox();
  const targetBefore = await target.boundingBox();
  const shadowsBefore = await page.locator('#hangBong').boundingBox();
  expect(from).not.toBeNull();
  expect(targetBefore).not.toBeNull();
  expect(shadowsBefore).not.toBeNull();

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await expect(page.locator('#khay')).toHaveAttribute('data-bh-drag-layout-locked', 'true');

  const shadowsDuring = await page.locator('#hangBong').boundingBox();
  expect(shadowsDuring).not.toBeNull();
  expect(Math.abs(shadowsDuring.y - shadowsBefore.y)).toBeLessThanOrEqual(1);

  await page.mouse.move(
    targetBefore.x + targetBefore.width / 2,
    targetBefore.y + targetBefore.height / 2,
    { steps: 8 }
  );
  await page.mouse.up();

  await expect(page.locator('#soDung')).toHaveText('3/6');
  await expect(page.locator('#khay')).not.toHaveAttribute('data-bh-drag-layout-locked', 'true');
});
