const { test, expect } = require('@playwright/test');

/*
 * Nút âm thanh nổi (#nutAmThanh) và banner "Thêm vào Màn hình chính" (.bh-install-tip, chỉ hiện trên Safari iOS)
 * cùng nằm ở đáy màn hình. Khi đã cuộn hết trang, không nút nào của trang được nằm dưới chúng,
 * và banner không được che nút âm thanh.
 */

// Banner cài app chỉ hiện với UA Safari iOS; các project E2E mặc định dùng UA Chromium.
const IOS_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const PAGES = ['index.html', ...Array.from({ length: 13 }, (_, index) => `game${index + 1}.html`), 'collection.html', 'parents.html'];

async function coveredControls(page) {
  return page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const floating = [...document.querySelectorAll('#nutAmThanh, .bh-install-tip')];
    const centerHit = (element) => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    };
    const covered = [];
    const tip = document.querySelector('.bh-install-tip');
    const sound = document.getElementById('nutAmThanh');
    if (tip && sound && tip.contains(centerHit(sound))) covered.push('#nutAmThanh dưới banner cài app');

    for (const element of document.querySelectorAll('button, a[href], [role="button"], input, select')) {
      if (floating.some((item) => item.contains(element))) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(element).visibility === 'hidden') continue;
      const centerY = rect.top + rect.height / 2;
      // Đã cuộn hết trang nên nút không thể lên cao hơn; nút còn nằm ngoài màn hình là do bố cục khác, không xét ở đây.
      if (centerY < 0 || centerY > innerHeight) continue;
      const cover = floating.find((item) => item.contains(centerHit(element)));
      if (cover) covered.push(`${element.id ? `#${element.id}` : element.className || element.tagName} "${element.textContent.trim().slice(0, 20)}" dưới ${cover.id ? `#${cover.id}` : `.${cover.className}`}`);
    }
    return covered;
  });
}

for (const withTip of [true, false]) {
  test.describe(`Nút nổi ở đáy màn hình không che nút của trang (${withTip ? 'có' : 'không có'} banner cài app)`, () => {
    if (withTip) test.use({ userAgent: IOS_SAFARI_UA });
    for (const path of PAGES) {
      test(`/${path}`, async ({ page }) => {
        await page.addInitScript((closed) => {
          if (closed) sessionStorage.setItem('bh_install_tip_closed', '1');
        }, !withTip);
        await page.goto(`/${path}`, { waitUntil: 'load' });
        await expect(page.locator('#nutAmThanh')).toBeVisible();
        if (withTip) await expect(page.locator('.bh-install-tip')).toBeVisible();
        await expect.poll(() => coveredControls(page), { timeout: 5000 }).toEqual([]);
      });
    }
  });
}

test.describe('Đóng banner cài app', () => {
  test.use({ userAgent: IOS_SAFARI_UA });

  test('nút âm thanh trở về sát đáy và phần chừa đáy trang thu lại', async ({ page }) => {
    await page.goto('/game2.html', { waitUntil: 'load' });
    const tip = page.locator('.bh-install-tip');
    await expect(tip).toBeVisible();
    const soundBottom = () => page.locator('#nutAmThanh').evaluate((element) => innerHeight - element.getBoundingClientRect().bottom);
    const reserved = () => page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
    await expect.poll(soundBottom).toBeGreaterThan(60);
    const before = await reserved();
    await tip.getByRole('button', { name: 'Đóng hướng dẫn' }).click();
    await expect.poll(soundBottom).toBeLessThan(30);
    await expect.poll(reserved).toBeLessThan(before);
    await expect.poll(() => coveredControls(page)).toEqual([]);
  });
});
