const { test, expect } = require('@playwright/test');

const instructionTargets = [
  { path: '/game1.html', selector: '.huong-dan' },
  { path: '/game2.html', selector: '.huong-dan' },
  { path: '/game3.html', selector: '.huong-dan' },
  { path: '/game4.html', selector: '.huong-dan' },
  { path: '/game5.html', selector: '.huong-dan' },
  { path: '/game6.html', selector: '.huong-dan' },
  { path: '/game7.html', selector: '.huong-dan' },
  { path: '/game8.html', selector: '.huong-dan' },
  { path: '/game9.html', selector: '.the-nhiem-vu .nho' },
  { path: '/game10.html', selector: '.huong-dan' }
];

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]) {
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(value) {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  return match[1].split(',').slice(0, 3).map((part) => Number.parseFloat(part.trim()));
}

async function renderedColors(locator) {
  return locator.evaluate((element) => {
    const foreground = getComputedStyle(element).color;
    let current = element;
    let background = 'rgba(0, 0, 0, 0)';

    while (current) {
      background = getComputedStyle(current).backgroundColor;
      if (background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)') break;
      current = current.parentElement;
    }

    if (!current) background = getComputedStyle(document.body).backgroundColor;
    return { foreground, background };
  });
}

test.describe('Độ tương phản chữ hướng dẫn', () => {
  for (const target of instructionTargets) {
    test(`${target.path} đạt tối thiểu 4.5:1`, async ({ page }) => {
      await page.goto(target.path, { waitUntil: 'domcontentloaded' });
      const instruction = page.locator(target.selector).first();
      await expect(instruction, `${target.path} cần phần hướng dẫn ${target.selector}`).toBeVisible();

      const colors = await renderedColors(instruction);
      const foreground = parseRgb(colors.foreground);
      const background = parseRgb(colors.background);

      expect(foreground, `${target.path} cần màu chữ render hợp lệ`).not.toBeNull();
      expect(background, `${target.path} cần màu nền render hợp lệ`).not.toBeNull();
      expect(
        contrastRatio(foreground, background),
        `${target.path} ${target.selector} có chữ hướng dẫn dưới 4.5:1`
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

/*
 * Lần vẽ đầu: components.css (nơi đặt màu chữ phụ đủ tương phản) do shared-ui.js nạp sau khi trang đã hiện. Chặn
 * hẳn tệp đó để đo màu chỉ với css/game-shell.css (nạp tĩnh, chặn render): chữ hướng dẫn, nhãn thống kê và câu khen
 * phải đạt 4.5:1 ngay từ lúc trang mới hiện, không chờ lớp dùng chung.
 */
test.describe('Độ tương phản chữ phụ trước khi CSS dùng chung nạp xong', () => {
  test.use({ serviceWorkers: 'block' });

  test('game 1–10: chữ hướng dẫn, nhãn ô số và câu khen đạt 4.5:1 chỉ với game-shell.css', async ({ page }) => {
    await page.route('**/css/components.css', (route) => route.abort());
    for (const target of instructionTargets) {
      await page.goto(target.path, { waitUntil: 'domcontentloaded' });
      await page.locator('.man-thang').evaluate((element) => element.classList.add('hien'));
      for (const selector of [target.selector, '.o-so .nhan', '.hop-thang .loi']) {
        const element = page.locator(selector).first();
        if (!(await element.count())) continue;
        const colors = await renderedColors(element);
        expect(
          contrastRatio(parseRgb(colors.foreground), parseRgb(colors.background)),
          `${target.path} ${selector} khi chưa có components.css`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
