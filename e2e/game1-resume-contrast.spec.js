const { test, expect } = require('@playwright/test');

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
  return value.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
}

test('hộp tiếp tục Game 1 giữ tương phản chữ tối thiểu 4.5:1', async ({ page }) => {
  await page.goto('/game1.html', { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    const dialog = document.createElement('div');
    dialog.className = 'bh-game1-resume';
    dialog.innerHTML = `
      <section class="bh-game1-resume-card">
        <p>Tiếp tục từ lượt trước?</p>
        <div class="bh-game1-resume-actions">
          <button class="bh-game1-continue">Tiếp tục</button>
          <button class="bh-game1-restart">Chơi lại</button>
        </div>
      </section>`;
    document.body.appendChild(dialog);
  });

  for (const selector of ['.bh-game1-resume p', '.bh-game1-continue', '.bh-game1-restart']) {
    const colors = await page.locator(selector).evaluate((element) => {
      const foreground = getComputedStyle(element).color;
      let current = element;
      let background = 'rgba(0, 0, 0, 0)';

      while (current) {
        background = getComputedStyle(current).backgroundColor;
        const alpha = background.match(/rgba?\([^)]*(?:,|\/)\s*([\d.]+)\s*\)$/)?.[1];
        const isTransparent = background === 'transparent' || (background.startsWith('rgba') && Number(alpha) === 0);
        if (!isTransparent) break;
        current = current.parentElement;
      }

      return { foreground, background };
    });

    const ratio = contrastRatio(parseRgb(colors.foreground), parseRgb(colors.background));
    expect(ratio, `${selector} cần đạt tương phản 4.5:1`).toBeGreaterThanOrEqual(4.5);
  }
});