const { test, expect } = require('@playwright/test');

test.describe('Gom đồ bằng bàn phím trong Game 4', () => {
  test('Enter chọn đồ vật và thả vào đúng giỏ', async ({ page }) => {
    await page.goto('/game4.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.BongGame4KeyboardSorting && document.querySelectorAll('.do-vat[tabindex="0"]').length > 0);

    const firstItem = page.locator('.do-vat:not(.xong)').first();
    const color = await firstItem.getAttribute('data-mau');
    expect(color, 'Đồ vật cần có data-mau').toBeTruthy();
    const item = page.locator(`.do-vat[data-mau="${color}"]`).first();
    const basket = page.locator(`.gio[data-mau="${color}"]`);

    await item.focus();
    await page.keyboard.press('Enter');
    await expect(item).toHaveAttribute('aria-pressed', 'true');

    await basket.focus();
    await page.keyboard.press('Enter');

    await expect(item).toHaveClass(/xong/);
    await expect(item).toHaveAttribute('tabindex', '-1');
    await expect(item).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#soGom')).toHaveText('1/12');
    await expect(page.locator('#bhGame4KeyboardStatus')).toContainText('đã vào đúng giỏ');
  });

  test('chọn sai trả focus về đồ vật để thử lại', async ({ page }) => {
    await page.goto('/game4.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.BongGame4KeyboardSorting && document.querySelectorAll('.do-vat[tabindex="0"]').length > 0);

    const firstItem = page.locator('.do-vat:not(.xong)').first();
    const color = await firstItem.getAttribute('data-mau');
    expect(color).toBeTruthy();
    const item = page.locator(`.do-vat[data-mau="${color}"]`).first();
    const wrongBasket = page.locator(`.gio:not([data-mau="${color}"])`).first();

    await item.focus();
    await page.keyboard.press('Space');
    await wrongBasket.focus();
    await page.keyboard.press('Space');

    await expect(item).not.toHaveClass(/xong/);
    await expect(item).toBeFocused();
    await expect(item).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#bhGame4KeyboardStatus')).toContainText('chưa đúng với giỏ này');
  });
});