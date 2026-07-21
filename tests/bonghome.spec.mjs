import { test, expect } from '@playwright/test';

const runtimeErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) || []).toEqual([]);
});

test('trang chủ tải đủ điều khiển chính', async ({ page }) => {
  await expect(page).toHaveTitle(/Bông/i);
  await expect(page.getByRole('button', { name: /15 phút/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /20 phút/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /phụ huynh/i })).toBeVisible();
  await expect(page.locator('.bh-step')).toHaveCount(10);
});

test('hồ sơ Bông được tạo và lưu cục bộ', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Bông/i })).toBeVisible();
  await page.waitForFunction(() => Boolean(window.BongStorage));
  const state = await page.evaluate(() => window.BongStorage.getState());
  expect(state.profiles.some((profile) => profile.name === 'Bông')).toBeTruthy();
});

test('bắt đầu phiên 15 phút và hiển thị đồng hồ', async ({ page }) => {
  await page.getByRole('button', { name: /15 phút/i }).click();
  await expect(page).toHaveURL(/game1\.html\?session=/);
  await expect(page.getByRole('button', { name: /Kết thúc buổi chơi/i })).toBeVisible();
  await expect(page.locator('.bh-session')).toContainText(/14:|15:/);
});

test('kết thúc sớm hiển thị tổng kết nhẹ nhàng', async ({ page }) => {
  await page.getByRole('button', { name: /15 phút/i }).click();
  await page.getByRole('button', { name: /Kết thúc buổi chơi/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(/buổi chơi|hoàn thành|nghỉ/i);
});

test('trang phụ huynh hiển thị tiến độ và lịch sử', async ({ page }) => {
  await page.goto('/parent.html');
  await expect(page.getByRole('heading', { name: /phụ huynh/i })).toBeVisible();
  await expect(page.locator('.bh-step')).toHaveCount(10);
});

test('không có cuộn ngang ở viewport hiện tại', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBeFalsy();
});

test('cả 10 game đều mở được mà không phát sinh lỗi JavaScript', async ({ page }) => {
  for (let game = 1; game <= 10; game += 1) {
    await page.goto(`/game${game}.html`);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('main, .khung, .tro-choi, body').first()).toBeVisible();
  }
});

test('game 1 bắt đầu với tám lá và giữ đủ ba mức khó', async ({ page }) => {
  await page.goto('/game1.html');
  await expect(page.locator('#sanBai')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dễ · 8 lá' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vừa · 12 lá' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Khó · 16 lá' })).toBeVisible();
  await expect(page.locator('#sanBai').locator('.la-bai')).toHaveCount(8);
});