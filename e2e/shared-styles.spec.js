const { test, expect } = require('@playwright/test');

/*
 * Kiểu dùng chung (css/common.css, css/design-tokens.css, css/themes.css) đo trên trang thật bằng kiểu đã tính, kể cả
 * với phần tử chèn sau khi trang tải (hộp thoại phần thưởng, hồ sơ…): nút bị vô hiệu, nút tự dựng role="button",
 * giảm chuyển động, focus ring, token thiết kế và màu theo chủ đề. Thay cho các kiểm tra so chuỗi CSS trong
 * tests/disabled-controls.test.js, tests/accessibility-shared-controls.test.js, tests/design-system-smoke.test.js,
 * tests/theme-system.test.js và các dòng "tệp CSS có prefers-reduced-motion" rải rác.
 */

async function openReady(page, path) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.BongModulesReady && typeof window.BongModulesReady.then === 'function');
  await page.evaluate(() => window.BongModulesReady);
  await page.waitForFunction(() => document.querySelector('link[data-bh-common]')?.sheet);
}

/** Chèn phần tử vào trang (sau khi tải xong) và trả về kiểu đã tính cần xét. */
const insert = (page, html, properties) => page.evaluate(({ markup, names }) => {
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  document.body.appendChild(holder);
  return [...holder.children].map((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return Object.fromEntries([...names.map((name) => [name, style.getPropertyValue(name)]), ['width', rect.width], ['height', rect.height]]);
  });
}, { markup: html, names: properties });

test.describe('Kiểu dùng chung', () => {
  test('nút bị vô hiệu (gốc và role="button") cùng một trạng thái nhìn thấy rõ và không bấm được', async ({ page }) => {
    await openReady(page, '/game2.html');
    const styles = await insert(page,
      '<button disabled>Gốc</button><div role="button" aria-disabled="true" tabindex="0">Tự dựng</div>',
      ['cursor', 'opacity', 'filter', 'pointer-events']);
    for (const style of styles) expect(style).toMatchObject({ cursor: 'not-allowed', opacity: '0.58', filter: 'saturate(0.55)' });
    // Nút gốc bị vô hiệu đã không nhận thao tác; nút tự dựng phải tắt pointer events thì mới không bấm được.
    expect(styles[1]['pointer-events']).toBe('none');
  });

  test('nút tự dựng role="button" có vùng chạm tối thiểu 44×44 và focus ring khi dùng bàn phím', async ({ page }) => {
    await openReady(page, '/game2.html');
    // Các game gắn role="button" lên ô, thẻ, hình (phần tử khối hoặc ô lưới): dựng phần tử nhỏ hơn 44px như vậy.
    const [style] = await insert(page, '<div role="button" tabindex="0" id="probeButton" style="width:10px;height:10px;display:inline-block">x</div>', []);
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
    // Đưa focus bằng bàn phím: :focus-visible chỉ bật khi người dùng đang dùng phím.
    await page.keyboard.press('Shift+Tab');
    await page.evaluate(() => document.getElementById('probeButton').focus());
    const focus = await page.locator('#probeButton').evaluate((element) => {
      const computed = getComputedStyle(element);
      return { style: computed.outlineStyle, width: parseFloat(computed.outlineWidth) };
    });
    expect(focus.style).not.toBe('none');
    expect(focus.width).toBeGreaterThanOrEqual(3);
  });

  test('giảm chuyển động áp cả cho phần tử chèn sau khi trang tải', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Game 12 chỉ có luật giảm chuyển động riêng cho ô và nút của nó: phần tử lạ chỉ còn luật chung của css/common.css.
    await openReady(page, '/game12.html');
    const [style] = await insert(page,
      '<div style="animation: bh-probe 2s infinite; transition: transform 1s;">x</div>',
      ['animation-duration', 'animation-iteration-count', 'transition-duration']);
    expect(parseFloat(style['animation-duration'])).toBeLessThanOrEqual(0.001);
    expect(style['animation-iteration-count']).toBe('1');
    expect(parseFloat(style['transition-duration'])).toBeLessThanOrEqual(0.001);
  });

  test('token thiết kế có giá trị; tên màu cũ của game (--kem, --chu, --tim) đi theo chủ đề đang chọn', async ({ page }) => {
    await openReady(page, '/parents.html');
    const read = (names) => page.evaluate((list) => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(list.map((name) => [name, style.getPropertyValue(name).trim().toLowerCase()]));
    }, names);
    const tokens = await read(['--bh-color-cream', '--bh-color-pink', '--bh-color-purple', '--bh-color-text', '--bh-touch-target']);
    for (const [name, value] of Object.entries(tokens)) expect(value, name).not.toBe('');
    expect(tokens['--bh-touch-target']).toBe('44px');

    for (const themeId of ['bong-home', 'animals']) {
      await page.evaluate((id) => window.BongThemes.setActiveTheme(id), themeId);
      await expect(page.locator('html')).toHaveAttribute('data-theme', themeId);
      const theme = await page.evaluate(() => window.BongThemes.getActiveTheme().tokens);
      const expected = [theme.background, theme.text, theme.primary].map((value) => value.toLowerCase());
      const values = await read(['--kem', '--chu', '--tim', '--bh-theme-background', '--bh-theme-text', '--bh-theme-primary']);
      expect(Object.values(values), themeId).toEqual([...expected, ...expected]);
    }
    expect((await read(['--tim']))['--tim']).toBe('#b9d89c');
  });
});
