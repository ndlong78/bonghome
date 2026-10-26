const { test, expect } = require('@playwright/test');

/*
 * shared-ui.js và các lớp phần thưởng nạp module theo trang (qua js/routes.js). Mở từng trang thật và đối chiếu
 * các module đã nạp (thuộc tính data-bh-* trên <script>/<link>) với bảng dưới: module của một game không được
 * nạp ở trang khác, module dùng chung có ở mọi trang. Thay cho các kiểm tra so chuỗi trong shared-ui.js.
 */

const COMMON = [
  'data-bh-common', 'data-bh-components', 'data-bh-design-tokens', 'data-bh-profile', 'data-bh-progress',
  'data-bh-pwa-ios', 'data-bh-pwa-quality', 'data-bh-rewards', 'data-bh-routes', 'data-bh-storage',
  'data-bh-theme-picker', 'data-bh-theme-picker-script', 'data-bh-themes', 'data-bh-themes-script'
];
const GAMES_2_TO_4 = ['data-bh-games-autosave-style', 'data-bh-games2-4-autosave', 'data-bh-games2-4-rewards'];
const GAMES_5_TO_7 = ['data-bh-games-autosave-style', 'data-bh-games5-7-autosave', 'data-bh-games5-7-rewards'];
const GAMES_8_TO_10 = ['data-bh-games-autosave-style', 'data-bh-games8-10-autosave', 'data-bh-games8-10-rewards'];

const PAGE_MODULES = {
  'index.html': ['data-bh-daily-journey', 'data-bh-game11-home-card', 'data-bh-game12-home-card', 'data-bh-game13-home-card', 'data-bh-profile-style', 'data-bh-profile-ui'],
  'game1.html': [
    'data-bh-game1-autosave', 'data-bh-game1-autosave-style', 'data-bh-game1-content', 'data-bh-game1-keyboard-accessibility',
    'data-bh-game1-rewards', 'data-bh-game1-theme-progress', 'data-game1-difficulty'
  ],
  'game2.html': [...GAMES_2_TO_4, 'data-bh-game2-keyboard-cursor'],
  'game3.html': [...GAMES_2_TO_4, 'data-bh-game3-drag-stability', 'data-bh-game3-keyboard-matching'],
  'game4.html': [...GAMES_2_TO_4, 'data-bh-game4-keyboard-sorting'],
  'game5.html': [...GAMES_5_TO_7, 'data-bh-game5-touch-target'],
  'game6.html': GAMES_5_TO_7,
  'game7.html': GAMES_5_TO_7,
  'game8.html': GAMES_8_TO_10,
  'game9.html': GAMES_8_TO_10,
  'game10.html': GAMES_8_TO_10,
  'game11.html': [],
  'game12.html': [],
  'game13.html': [],
  'collection.html': [],
  'parents.html': []
};

// Thứ tự nạp là hành vi: lớp phần thưởng phải bọc BongProgress trước khi autosave dùng nó; Game 1 nạp nội dung
// chủ đề → progress theo chủ đề → phần thưởng → autosave. Các script này cùng gắn vào <head> nên thứ tự trong DOM
// là thứ tự nạp (game1-difficulty.js gắn vào <body> nên không so ở đây).
const LOAD_ORDER = {
  'game1.html': ['data-bh-routes', 'data-bh-game1-content', 'data-bh-game1-theme-progress', 'data-bh-game1-rewards', 'data-bh-game1-autosave'],
  'game2.html': ['data-bh-routes', 'data-bh-games2-4-rewards', 'data-bh-games2-4-autosave'],
  'game5.html': ['data-bh-routes', 'data-bh-games5-7-rewards', 'data-bh-games5-7-autosave'],
  'game8.html': ['data-bh-routes', 'data-bh-games8-10-rewards', 'data-bh-games8-10-autosave']
};

const loadOrder = (page, markers) => page.evaluate((names) => {
  const elements = [...document.querySelectorAll('script, link')];
  return names.map((name) => elements.findIndex((element) => element.hasAttribute(name)));
}, markers);

const loadedModules = (page) => page.evaluate(() => [...new Set([...document.querySelectorAll('script, link')]
  .flatMap((element) => [...element.attributes].map((attribute) => attribute.name))
  .filter((name) => name.startsWith('data-bh-') || name === 'data-game1-difficulty'))].sort());

test.describe('Module được nạp đúng theo trang', () => {
  for (const [path, own] of Object.entries(PAGE_MODULES)) {
    test(`/${path}`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`/${path}`, { waitUntil: 'load' });
      // Lớp nạp chạy nối tiếp (routes → modules → nội dung/phần thưởng → autosave): chờ tới khi đủ bộ.
      await expect.poll(() => loadedModules(page), { timeout: 10_000 }).toEqual([...new Set([...COMMON, ...own])].sort());
      if (LOAD_ORDER[path]) {
        const order = await loadOrder(page, LOAD_ORDER[path]);
        expect(order, LOAD_ORDER[path].join(' → ')).toEqual([...order].sort((a, b) => a - b));
      }
      expect(errors).toEqual([]);
    });
  }
});
