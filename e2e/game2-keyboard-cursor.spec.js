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

  test('bốn phím mũi tên đi đúng hướng, dừng ở mép tranh; phím cách cũng chọn vị trí', async ({ page }) => {
    await page.goto('/game2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.BongGame2KeyboardCursor && document.querySelector('#tranhB .bh-game2-keyboard-cursor'));
    const { step, min, max } = await page.evaluate(() => window.BongGame2KeyboardCursor);
    const picture = page.locator('#tranhB');
    const cursor = picture.locator('.bh-game2-keyboard-cursor');
    const position = async () => [Number(await cursor.getAttribute('cx')), Number(await cursor.getAttribute('cy'))];
    await picture.focus();
    const [x0, y0] = await position();

    for (const [key, dx, dy] of [['ArrowRight', step, 0], ['ArrowDown', 0, step], ['ArrowLeft', -step, 0], ['ArrowUp', 0, -step]]) {
      const [x, y] = await position();
      await page.keyboard.press(key);
      expect(await position(), key).toEqual([x + dx, y + dy]);
    }
    expect(await position()).toEqual([x0, y0]);

    // Giữ phím tới quá mép: con trỏ dừng ở biên của tranh.
    for (let i = 0; i < 20; i += 1) await page.keyboard.press('ArrowLeft');
    for (let i = 0; i < 20; i += 1) await page.keyboard.press('ArrowUp');
    expect(await position()).toEqual([min, min]);
    for (let i = 0; i < 20; i += 1) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 20; i += 1) await page.keyboard.press('ArrowDown');
    expect(await position()).toEqual([max, max]);

    const status = page.locator('#bhGame2KeyboardStatus');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveAttribute('aria-atomic', 'true');
    await expect(status).toHaveText(`Tranh 2, cột ${(max - min) / step + 1}, hàng ${(max - min) / step + 1}`);

    // Phím cách chọn đúng vị trí con trỏ (gửi click vào tranh như chạm thật), không cuộn trang.
    const clicks = page.evaluate(() => new Promise((resolve) => {
      document.getElementById('tranhB').addEventListener('click', (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        resolve([Math.round(((event.clientX - rect.left) / rect.width) * 300), Math.round(((event.clientY - rect.top) / rect.height) * 300)]);
      }, { once: true });
    }));
    const scrollBefore = await page.evaluate(() => scrollY);
    await page.keyboard.press('Space');
    const [clickX, clickY] = await clicks;
    // Toạ độ chuột là pixel màn hình, đổi ngược ra toạ độ tranh có sai số làm tròn ±1.
    expect(Math.abs(clickX - max)).toBeLessThanOrEqual(1);
    expect(Math.abs(clickY - max)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
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
