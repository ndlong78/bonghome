const { test, expect } = require('@playwright/test');

test.describe('Ghép hình bằng bàn phím trong Game 3', () => {
  test('Enter chọn hình và thả vào đúng bóng bằng luồng pointer hiện có', async ({ page }) => {
    await page.goto('/game3.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.BongGame3KeyboardMatching && document.querySelectorAll('.mieng-hinh[tabindex="0"]').length > 0);

    const piece = page.locator('.mieng-hinh:not(.xong)').first();
    const id = await piece.getAttribute('data-id');
    const shadow = page.locator(`.o-bong[data-id="${id}"]`);

    await piece.focus();
    await page.keyboard.press('Enter');
    await expect(piece).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#bhGame3KeyboardStatus')).toContainText('đã được chọn');

    await shadow.focus();
    await page.keyboard.press('Enter');

    await expect(piece).toHaveClass(/xong/);
    await expect(piece).toHaveAttribute('tabindex', '-1');
    await expect(piece).toHaveAttribute('aria-disabled', 'true');
    await expect(shadow).toHaveClass(/dung/);
    await expect(shadow).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('#soDung')).toHaveText('1/6');
    await expect(page.locator('#bhGame3KeyboardStatus')).toContainText('đã ghép đúng');
  });

  test('chọn sai trả focus về hình và cho phép thử lại', async ({ page }) => {
    await page.goto('/game3.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.BongGame3KeyboardMatching);

    const piece = page.locator('.mieng-hinh:not(.xong)').first();
    const id = await piece.getAttribute('data-id');
    const wrongShadow = page.locator(`.o-bong:not([data-id="${id}"])`).first();

    await piece.focus();
    await page.keyboard.press('Space');
    await wrongShadow.focus();
    await page.keyboard.press('Space');

    await expect(piece).not.toHaveClass(/xong/);
    await expect(piece).toBeFocused();
    await expect(piece).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#bhGame3KeyboardStatus')).toContainText('chưa đúng với bóng này');
  });
});