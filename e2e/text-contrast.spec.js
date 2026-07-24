const { test, expect } = require('@playwright/test');

const pages = [
  '/index.html',
  '/parents.html',
  '/collection.html',
  ...Array.from({ length: 10 }, (_, index) => `/game${index + 1}.html`)
];

const controls = [
  '.nut-ve',
  '.bh-button',
  '.nut-am-thanh',
  '.nut-choi-lai',
  '.nhom-nut a',
  '.nut-van-moi',
  '.nut-goi-y',
  '.bh-parent-back',
  '.bh-collection__back'
].join(',');

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
  const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
}

function composite(foreground, background) {
  const alpha = foreground[3];
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha),
    1
  ];
}

test.describe('Độ tương phản chữ trên điều khiển chung', () => {
  for (const path of pages) {
    test(`${path} giữ tỷ lệ tương phản tối thiểu 4.5:1`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('.nut-am-thanh'));

      const samples = await page.locator(controls).evaluateAll((elements) => {
        const parse = (value) => {
          const match = value.match(/rgba?\(([^)]+)\)/);
          if (!match) return null;
          const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
          return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
        };
        const mix = (foreground, background) => {
          const alpha = foreground[3];
          return [
            foreground[0] * alpha + background[0] * (1 - alpha),
            foreground[1] * alpha + background[1] * (1 - alpha),
            foreground[2] * alpha + background[2] * (1 - alpha),
            1
          ];
        };
        const effectiveBackground = (element) => {
          let current = element;
          let result = [255, 255, 255, 1];
          const layers = [];
          while (current) {
            const color = parse(getComputedStyle(current).backgroundColor);
            if (color && color[3] > 0) layers.push(color);
            current = current.parentElement;
          }
          for (let index = layers.length - 1; index >= 0; index -= 1) result = mix(layers[index], result);
          return result;
        };

        return elements
          .filter((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none'
              && style.visibility !== 'hidden'
              && rect.width > 0
              && rect.height > 0
              && !element.matches(':disabled,[aria-disabled="true"]');
          })
          .map((element) => ({
            label: element.getAttribute('aria-label') || element.textContent?.trim() || element.className,
            foreground: parse(getComputedStyle(element).color),
            background: effectiveBackground(element)
          }));
      });

      const failures = samples.map((sample) => {
        const foreground = composite(sample.foreground, sample.background);
        return {
          ...sample,
          ratio: Math.round(contrastRatio(foreground, sample.background) * 100) / 100
        };
      }).filter(({ ratio }) => ratio < 4.5);

      expect(samples.length, `${path} cần có điều khiển để audit`).toBeGreaterThan(0);
      expect(failures, `${path} có chữ trên nút dưới mức 4.5:1`).toEqual([]);
    });
  }
});
