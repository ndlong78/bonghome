const { test, expect } = require('@playwright/test');

/*
 * Bố cục vùng chơi đo trên trang thật: số cột theo bề rộng màn hình, phím hướng xếp hình chữ thập, nút chính trải hết
 * bề ngang, tranh SVG giữ hệ toạ độ 300×300 và lấp đầy khung. Thay cho các kiểm tra so chuỗi CSS trong
 * tests/game2|games3-4|games6-7|games8-10-gameplay-touch-targets.test.js. Kích thước tối thiểu 44px của từng mục tiêu:
 * e2e/*-gameplay-touch-targets.spec.js.
 */

const round = (value) => Math.round(value);

/** Số cột và số hàng mà các phần tử đang chiếm (theo toạ độ trái/trên đã làm tròn). */
const gridShape = (locator) => locator.evaluateAll((elements) => ({
  columns: new Set(elements.map((element) => Math.round(element.getBoundingClientRect().left))).size,
  rows: new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top))).size
}));

/** Màn hẹp (≤520px) xếp 2 cột, rộng hơn xếp 4 cột. */
const expectedColumns = (page) => (page.viewportSize().width <= 520 ? 2 : 4);

test.describe('Bố cục vùng chơi', () => {
  test('Game 7: bốn lựa chọn xếp 4 cột, màn hẹp 2 cột; hình lấp đầy nút', async ({ page }) => {
    await page.goto('/game7.html', { waitUntil: 'domcontentloaded' });
    const choices = page.locator('#luaChon .nut-chon');
    await expect(choices).toHaveCount(4);
    const columns = expectedColumns(page);
    expect(await gridShape(choices)).toEqual({ columns, rows: 4 / columns });
    const fill = await choices.first().evaluate((button) => {
      const svg = button.querySelector('svg');
      const style = getComputedStyle(button);
      const content = button.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return { svg: svg.getBoundingClientRect().width, content };
    });
    expect(Math.abs(fill.svg - fill.content)).toBeLessThanOrEqual(1);
  });

  test('Game 4: bốn giỏ xếp 4 cột, màn hẹp 2 cột', async ({ page }) => {
    await page.goto('/game4.html', { waitUntil: 'domcontentloaded' });
    const baskets = page.locator('.hang-gio .gio');
    await expect(baskets).toHaveCount(4);
    const columns = expectedColumns(page);
    expect(await gridShape(baskets)).toEqual({ columns, rows: 4 / columns });
  });

  test('Game 8: phím hướng xếp hình chữ thập — lên ở giữa hàng trên; trái, xuống, phải ở hàng dưới', async ({ page }) => {
    await page.goto('/game8.html', { waitUntil: 'domcontentloaded' });
    const names = ['Đi lên', 'Sang trái', 'Đi xuống', 'Sang phải'];
    const [up, left, down, right] = await Promise.all(names.map((name) => page.getByRole('button', { name, exact: true }).boundingBox()));
    expect(round(left.y)).toBe(round(down.y));
    expect(round(down.y)).toBe(round(right.y));
    expect(up.y + up.height).toBeLessThanOrEqual(down.y + 1);
    expect(round(up.x)).toBe(round(down.x));
    expect(left.x + left.width).toBeLessThanOrEqual(down.x + 1);
    expect(down.x + down.width).toBeLessThanOrEqual(right.x + 1);
    // Thứ tự Tab theo chiều đọc: lên → trái → xuống → phải.
    expect(await page.locator('.phim-huong button').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label'))))
      .toEqual(names);
  });

  for (const [path, selector] of [['/game9.html', '#nutBat'], ['/game10.html', '#nutGo']]) {
    test(`${path}: nút chính trải hết bề ngang khung chứa`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const widths = await page.locator(selector).evaluate((button) => {
        const parent = button.parentElement;
        const style = getComputedStyle(parent);
        return {
          button: button.getBoundingClientRect().width,
          content: parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        };
      });
      expect(Math.abs(widths.button - widths.content)).toBeLessThanOrEqual(1);
    });
  }

  test('Game 2: hai tranh dùng hệ toạ độ 300×300 và lấp đầy khung tranh', async ({ page }) => {
    await page.goto('/game2.html', { waitUntil: 'domcontentloaded' });
    for (const id of ['tranhA', 'tranhB']) {
      const svg = page.locator(`#${id}`);
      const viewBox = await svg.evaluate((element) => {
        const { x, y, width, height } = element.viewBox.baseVal;
        return [x, y, width, height];
      });
      expect(viewBox, id).toEqual([0, 0, 300, 300]);
      const fill = await svg.evaluate((element) => {
        const frame = element.closest('.tranh');
        const style = getComputedStyle(frame);
        const rect = element.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          content: frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        };
      });
      expect(Math.abs(fill.width - fill.content), id).toBeLessThanOrEqual(1);
      expect(Math.abs(fill.width - fill.height), `${id} vuông`).toBeLessThanOrEqual(1);
    }
  });
});
