const { test, expect } = require('@playwright/test');

/*
 * Cấu trúc trợ năng và bố cục của từng trang, kiểm trên trang thật (cây trợ năng, kích thước, kiểu đã tính) thay vì
 * so chuỗi trong HTML/CSS: ngôn ngữ và viewport, vùng nội dung chính có tên, kích thước các nút trang chủ, hộp thoại
 * thắng có tên, mô tả và nút, điều khiển game 11–13 có tên, trang phụ huynh chỉ đọc, bàn Sudoku xếp đúng số cột.
 * Thay cho các kiểm tra so chuỗi trong tests/accessibility-baseline.test.js, tests/parent-dashboard.test.js và
 * tests/game11/12/13-*.test.js.
 */

const GAMES_1_TO_10 = Array.from({ length: 10 }, (_, index) => `/game${index + 1}.html`);
const ALL_PAGES = ['/index.html', '/parents.html', '/collection.html', ...Array.from({ length: 13 }, (_, index) => `/game${index + 1}.html`)];

/** Chữ của các phần tử mà aria-labelledby/aria-describedby trỏ tới (phải có thật và có chữ). */
const referencedText = (locator, attribute) => locator.evaluate((element, name) => (element.getAttribute(name) || '')
  .split(/\s+/).filter(Boolean)
  .map((id) => document.getElementById(id)?.textContent.trim() || '')
  .join(' ').trim(), attribute);
const labelledByText = (locator) => referencedText(locator, 'aria-labelledby');

test.describe('Cấu trúc trang', () => {
  test('mọi trang khai báo tiếng Việt và viewport an toàn cho tai thỏ iPhone/iPad', async ({ page }) => {
    for (const path of ALL_PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('html'), path).toHaveAttribute('lang', 'vi');
      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport, path).toMatch(/viewport-fit=cover/);
    }
  });

  test('trang phụ huynh và bộ sưu tập có vùng nội dung chính mang tên tiêu đề trang', async ({ page }) => {
    for (const [path, title] of [['/parents.html', 'Góc phụ huynh'], ['/collection.html', 'Bộ sưu tập của Bông']]) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('main', { name: title }), path).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: title }), path).toBeVisible();
    }
    // Bộ sưu tập: avatar của bé và số sao (đọc qua live region khi cập nhật).
    await expect(page.locator('#collectionAvatar')).toBeVisible();
    await expect(page.locator('#collectionStars')).toHaveAttribute('aria-live', 'polite');
  });

  test('trang chủ: nút hồ sơ, chọn chủ đề, lối vào Bộ sưu tập/Góc phụ huynh đủ 44px; thẻ hành trình trên màn hẹp cao 72px', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.BongModulesReady && typeof window.BongModulesReady.then === 'function');
    await page.evaluate(() => window.BongModulesReady);
    await expect(page.locator('a.bh-parent-link')).toHaveCount(2);
    await expect(page.locator('.bh-daily-activity').first()).toBeVisible();
    const heights = (selector) => page.locator(selector).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
    for (const selector of ['#bhProfileButton', 'a.bh-parent-link', '.bh-theme-picker button']) {
      const list = await heights(selector);
      expect(list.length, selector).toBeGreaterThan(0);
      for (const height of list) expect(height, selector).toBeGreaterThanOrEqual(44);
    }
    if (page.viewportSize().width <= 720) {
      for (const height of await heights('.bh-daily-activity')) expect(height).toBeGreaterThanOrEqual(72);
    }
  });

  test('game 1–10: hộp thoại thắng là modal có tên, mô tả và nút để chơi tiếp', async ({ page }) => {
    for (const path of GAMES_1_TO_10) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const dialog = page.locator('.man-thang');
      await expect(dialog, path).toHaveCount(1);
      await expect(dialog, path).toHaveAttribute('role', 'dialog');
      await expect(dialog, path).toHaveAttribute('aria-modal', 'true');
      expect(await labelledByText(dialog), `${path}: tên hộp thoại`).not.toBe('');
      expect(await referencedText(dialog, 'aria-describedby'), `${path}: câu khen mô tả hộp thoại`).not.toBe('');
      // Lúc chưa thắng, hộp thoại không che bàn chơi.
      await expect(dialog, path).toBeHidden();
      // Hiện hộp thoại như khi thắng: có ít nhất một nút/đường dẫn nhìn thấy để chơi tiếp hoặc về trang chủ.
      await dialog.evaluate((element) => element.classList.add('hien'));
      await expect(dialog, path).toBeVisible();
      expect(await dialog.locator('.nhom-nut').getByRole('button').or(dialog.locator('.nhom-nut').getByRole('link')).count(), path)
        .toBeGreaterThan(0);
    }
  });

  test('Game 11: bàn là grid nhận focus, đủ nút điều khiển có tên, có hướng dẫn chuột/chạm và không đếm ngược', async ({ page, browser, baseURL }) => {
    await page.goto('/game11.html', { waitUntil: 'domcontentloaded' });
    const board = page.getByRole('grid', { name: /Bàn xếp khối 16 hàng 10 cột/ });
    await board.focus();
    await expect(board).toBeFocused();
    const controls = page.getByRole('group', { name: 'Điều khiển khối' });
    for (const name of ['Di chuyển sang trái', 'Quay khối', 'Di chuyển sang phải', 'Thả khối xuống']) {
      await expect(controls.getByRole('button', { name }), name).toBeVisible();
    }
    await expect(page.locator('#blockStatus')).toHaveAttribute('aria-live', 'polite');
    // Màn hình chạm ẩn hướng dẫn rê chuột và lời nhắc "không đếm ngược" để bàn đủ chỗ; máy có chuột thì hiện cả hai,
    // và bàn báo con trỏ kéo ngang.
    const hint = /Rê chuột trái\/phải.*Click\/chạm: quay khối/;
    const noCountdown = /không có đồng hồ đếm ngược/i;
    await expect(page.getByText(hint)).toBeHidden();
    await expect(page.getByText(noCountdown)).toBeHidden();
    // browser.newContext trong Playwright Test kế thừa tuỳ chọn của project (isMobile, hasTouch): ghi rõ để là máy có chuột.
    const desktop = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1, locale: 'vi-VN' });
    try {
      const desktopPage = await desktop.newPage();
      await desktopPage.goto('/game11.html', { waitUntil: 'domcontentloaded' });
      await expect(desktopPage.getByText(hint)).toBeVisible();
      await expect(desktopPage.getByText(noCountdown)).toBeVisible();
      expect(await desktopPage.locator('#blockBoard').evaluate((element) => getComputedStyle(element).cursor)).toBe('ew-resize');
    } finally {
      await desktop.close();
    }
  });

  test('Game 12: bàn là grid nhận focus, đủ công cụ có tên, mỗi cỡ bàn xếp đúng số cột và không đếm ngược', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('bonghome_game12_sudoku'));
    await page.goto('/game12.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.BongGame12));
    const board = page.getByRole('grid', { name: /Bàn Sudoku/ });
    await board.focus();
    await expect(board).toBeFocused();
    await expect(page.getByRole('group', { name: 'Chọn cỡ bàn' }).getByRole('button')).toHaveCount(3);
    await expect(page.getByRole('group', { name: 'Chọn hình để điền' })).toBeVisible();
    for (const id of ['sudokuErase', 'sudokuHint', 'sudokuCheck', 'sudokuRestart', 'sudokuNew']) {
      const button = page.locator(`#${id}`);
      await expect(button, id).toBeVisible();
      expect((await button.getAttribute('aria-label')) || (await button.textContent()).trim(), id).not.toBe('');
    }
    await expect(page.locator('#sudokuStatus')).toHaveAttribute('aria-live', 'polite');
    const win = page.locator('#sudokuWin [role="dialog"]');
    await expect(win).toHaveAttribute('aria-modal', 'true');
    expect(await labelledByText(win)).not.toBe('');
    await expect(win.locator('#sudokuWinRewards')).toHaveAttribute('role', 'status');
    await expect(page.getByText(/Không có đồng hồ đếm ngược/)).toBeVisible();

    // Hàng chỉ là lớp nhóm (display: contents): các ô nằm thẳng trên lưới N×N của bàn.
    for (const [level, size] of [['mam', 4], ['choi', 6], ['cay', 9]]) {
      await page.locator(`.sudoku-level[data-level="${level}"]`).click();
      await expect(page.locator('.sudoku-cell')).toHaveCount(size * size);
      const layout = await page.locator('.sudoku-cell').evaluateAll((cells) => {
        const round = (value) => Math.round(value);
        return {
          columns: new Set(cells.map((cell) => round(cell.getBoundingClientRect().left))).size,
          rows: new Set(cells.map((cell) => round(cell.getBoundingClientRect().top))).size
        };
      });
      expect(layout, level).toEqual({ columns: size, rows: size });
    }
  });

  test('Game 13: đủ điều khiển có tên, tỉ số, hộp thoại thắng là modal có tên và không đếm ngược', async ({ page }) => {
    await page.goto('/game13.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.BongGame13));
    await expect(page.getByRole('group', { name: /Bàn cờ 3×3/ }).getByRole('button')).toHaveCount(9);
    await expect(page.getByRole('group', { name: 'Chọn người chơi cùng' }).getByRole('button')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Bắt đầu ván mới' })).toBeVisible();
    for (const id of ['tttTurn', 'tttScorePlayer', 'tttScoreDraw', 'tttScoreBot']) await expect(page.locator(`#${id}`), id).toBeVisible();
    await expect(page.locator('#tttStatus')).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByText(/Không có đồng hồ đếm ngược/)).toBeVisible();

    const dialog = page.locator('#tttWin [role="dialog"]');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(await labelledByText(dialog)).not.toBe('');
    await expect(dialog).toBeHidden();
    await expect(dialog.locator('#tttWinNext')).toHaveCount(1);
    await expect(dialog.locator('#tttWinRewards')).toHaveAttribute('role', 'status');
  });

  test('trang phụ huynh chỉ đọc: ô nhập duy nhất là câu hỏi cổng phụ huynh trong hộp thoại xóa, không gửi đi đâu', async ({ page }) => {
    await page.goto('/parents.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.BongModulesReady);
    await expect(page.locator('form, textarea, select')).toHaveCount(0);
    const inputs = page.locator('input');
    await expect(inputs).toHaveCount(1);
    await expect(inputs).toHaveAttribute('id', 'parentGateAnswer');
    expect(await inputs.getAttribute('name')).toBeNull();
    expect(await inputs.evaluate((input) => input.closest('dialog')?.id)).toBe('parentDataDialog');
    await expect(page.getByText(/Dữ liệu hồ sơ, tiến độ và phần thưởng chỉ được lưu/)).toBeVisible();
    await expect(page.getByText(/không tạo mục tiêu ngày hay áp lực/)).toBeVisible();
  });
});
