const { test, expect } = require('@playwright/test');

test.describe('Con trỏ bàn phím Game 2', () => {
  test('mũi tên di chuyển con trỏ và Enter dùng luồng click hiện có', async ({ page }) => {
    await page.goto('/game2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.BongGame2KeyboardCursor && document.querySelector('#tranhA .bh-game2-keyboard-cursor'));

    const picture = page.locator('#tranhA');
    await picture.focus();

    const cursor = picture.locator('.bh-game2-keyboard-cursor');
    await expect(cursor).toBeVisible();
    await expect(picture).toHaveAttribute('tabindex', '0');
    await expect(picture).toHaveAttribute('aria-describedby', 'bhGame2KeyboardInstructions');

    const before = await cursor.getAttribute('cx');
    await page.keyboard.press('ArrowRight');
    const after = await cursor.getAttribute('cx');
    expect(Number(after), 'ArrowRight phải di chuyển con trỏ sang phải').toBeGreaterThan(Number(before));

    await page.evaluate(() => {
      window.__bhGame2KeyboardClicks = 0;
      document.getElementById('tranhA').addEventListener('click', () => {
        window.__bhGame2KeyboardClicks += 1;
      });
    });
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__bhGame2KeyboardClicks)).toBe(1);

    const status = page.locator('#bhGame2KeyboardStatus');
    await expect(status).toContainText(/Tranh 1, cột \d+, hàng \d+/);
  });

  test('con trỏ ẩn khi rời khỏi bức tranh', async ({ page }) => {
    await page.goto('/game2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.BongGame2KeyboardCursor);

    await page.locator('#tranhB').focus();
    await expect(page.locator('#tranhB .bh-game2-keyboard-cursor')).toBeVisible();
    await page.locator('#nutGoiY').focus();
    await expect(page.locator('#tranhB .bh-game2-keyboard-cursor')).toBeHidden();
  });
});
