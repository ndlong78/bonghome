const { test, expect } = require('@playwright/test');

const MIN_TARGET_PX = 44;
const MIN_TARGET_VIEWBOX_UNITS = 44;

async function readPictureTargetState(page, selector) {
  return page.locator(selector).evaluate((svg, config) => {
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const style = getComputedStyle(svg);
    const centerElement = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const scaleX = rect.width / viewBox.width;
    const scaleY = rect.height / viewBox.height;
    return {
      width: rect.width,
      height: rect.height,
      pointerEvents: style.pointerEvents,
      visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
      centerBelongsToPicture: Boolean(centerElement?.closest(selector)),
      minimumRenderedTarget: Math.min(scaleX, scaleY) * config.minimumViewBoxTarget
    };
  }, { minimumViewBoxTarget: MIN_TARGET_VIEWBOX_UNITS });
}

test.describe('Vùng chạm gameplay Game 2', () => {
  for (const selector of ['#tranhA', '#tranhB']) {
    test(`${selector} giữ vùng chạm điểm khác biệt tối thiểu 44px`, async ({ page }) => {
      await page.goto('/game2.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('#tranhA > *, #tranhB > *').length > 0);

      const state = await readPictureTargetState(page, selector);
      expect(state.visible, `${selector} cần hiển thị để nhận thao tác chạm`).toBe(true);
      expect(state.pointerEvents, `${selector} không được vô hiệu hóa pointer events`).not.toBe('none');
      expect(state.centerBelongsToPicture, `Tâm ${selector} không được bị phần tử khác che`).toBe(true);
      expect(state.minimumRenderedTarget, `${selector} có vùng chạm nhỏ nhất ${state.minimumRenderedTarget.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    });
  }
});
