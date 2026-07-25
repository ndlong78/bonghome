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
