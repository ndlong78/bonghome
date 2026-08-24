const { test, expect } = require('@playwright/test');

// Vòng đời thật của autosave: lưu ván đang chơi, tải lại trang, khôi phục được.
// Đây là hợp đồng quan trọng nhất của tính năng — nếu hỏng thì bé mất tiến độ.
const GROUPS = [
  { globalName: 'BongGamesAutosave', games: ['game2', 'game3', 'game4'] },
  { globalName: 'BongGames57Autosave', games: ['game5', 'game6', 'game7'] },
  { globalName: 'BongGames810Autosave', games: ['game8', 'game9', 'game10'] }
];

for (const { globalName, games } of GROUPS) {
  for (const gameId of games) {
    test(`${gameId} lưu ván đang chơi rồi khôi phục sau khi tải lại`, async ({ page }) => {
      // Không dùng addInitScript để xóa localStorage: nó chạy lại ở mỗi lần điều
      // hướng, kể cả reload — sẽ xóa mất đúng bản lưu mà test này cần kiểm.
      // Mỗi test đã chạy trong context riêng nên kho bắt đầu vốn đã rỗng.
      await page.goto(`/${gameId}.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction((name) => Boolean(window[name]), globalName);

      // Game 9 và 10 chỉ cho lưu khi ván đã bắt đầu.
      const startButton = page.locator('#nutBatDau');
      if (await startButton.count()) {
        await startButton.click();
        await page.waitForTimeout(150);
      }

      const captured = await page.evaluate((name) => {
        window[name].save();
        return window[name].capture();
      }, globalName);

      expect(captured, `${gameId} phải chụp được trạng thái`).toBeTruthy();

      // Trạng thái phải nằm thật trong kho, dưới đúng khóa của game.
      const stored = await page.evaluate((id) => {
        const raw = localStorage.getItem('bonghome:data');
        if (!raw) return null;
        return JSON.parse(raw)?.data?.progress?.games?.[id] ?? null;
      }, gameId);

      expect(stored, `${gameId} phải được ghi vào bonghome:data`).toBeTruthy();
      expect(stored.status).toBe('in_progress');
      expect(stored.state, `${gameId} phải lưu kèm trạng thái ván chơi`).toBeTruthy();
      expect(stored.state.sessionId).toBe(captured.sessionId);

      // Tải lại: module phải nhận ra bản lưu và khôi phục thành công.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction((name) => Boolean(window[name]), globalName);

      await expect(page.locator('#bhGameAutosaveStatus')).toContainText(
        'Đã khôi phục ván đang chơi',
        { timeout: 5000 }
      );

      // Phiên được khôi phục phải là đúng phiên đã lưu, không phải phiên mới.
      const restored = await page.evaluate((name) => window[name].capture(), globalName);
      expect(restored.sessionId, `${gameId} phải khôi phục đúng phiên đã lưu`).toBe(captured.sessionId);
    });
  }
}
